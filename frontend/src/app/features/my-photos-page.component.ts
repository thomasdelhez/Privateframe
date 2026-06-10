import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Post, PostAccessRequest } from '../core/api.service';
import { AuthenticatedImageDirective } from '../core/authenticated-image.directive';
import { SessionService } from '../core/session.service';

interface AlbumDraft {
  title: string;
  description: string;
  isPrivate: boolean;
}

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, AuthenticatedImageDirective],
  template: `
    <section class="photos-page">
      <header class="hero">
        <div>
          <p class="eyebrow">Mijn foto's</p>
          <h1>Beheer je albums en foto's</h1>
          <p class="lead">
            Maak albums, bepaal wie ze kan bekijken en beheer elke foto vanaf één overzichtelijke plek.
          </p>
        </div>
        <div class="hero-summary" aria-label="Foto-overzicht">
          <div><strong>{{ albums().length }}</strong><span>Albums</span></div>
          <div><strong>{{ photoCount() }}</strong><span>Foto's</span></div>
          <div><strong>{{ pendingRequestCount() }}</strong><span>Verzoeken</span></div>
        </div>
      </header>

      @if (error()) {
        <p class="notice error">{{ error() }}</p>
      }
      @if (success()) {
        <p class="notice success">{{ success() }}</p>
      }

      @if (!session.user()?.age_confirmed) {
        <article class="panel age-gate">
          <div>
            <h2>Bevestig eerst je leeftijd</h2>
            <p class="muted">Fotoalbums zijn beschikbaar nadat je de 18+-bevestiging hebt afgerond.</p>
          </div>
          <a routerLink="/age" class="secondary-link">Leeftijd bevestigen</a>
        </article>
      } @else {
        <div class="dashboard">
          <section class="album-column" aria-label="Mijn albums">
            <article class="panel create-panel">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Nieuw</p>
                  <h2>Album aanmaken</h2>
                </div>
                <button type="button" class="secondary compact-button" (click)="toggleCreateForm()">
                  {{ isCreateFormOpen() ? 'Sluiten' : 'Nieuw album' }}
                </button>
              </div>

              @if (isCreateFormOpen()) {
                <form class="album-form" (ngSubmit)="createAlbum()">
                  <label>
                    Albumtitel
                    <input name="albumTitle" [(ngModel)]="newTitle" maxlength="160" placeholder="Bijv. Weekend in Antwerpen" required />
                  </label>
                  <label>
                    Beschrijving
                    <textarea name="albumDescription" [(ngModel)]="newDescription" maxlength="1500" rows="3" placeholder="Vertel kort iets over dit album"></textarea>
                  </label>
                  <label class="toggle-row">
                    <input type="checkbox" name="albumPrivate" [(ngModel)]="newPrivate" />
                    <span>
                      <strong>Privéalbum</strong>
                      <small>Bezoekers zien een geblurde preview en moeten toegang aanvragen.</small>
                    </span>
                  </label>

                  <fieldset class="consent-grid">
                    <legend>Bevestigingen</legend>
                    <label><input type="checkbox" name="ruleAge" [(ngModel)]="ruleAge" /><span>Iedereen op de foto's is 18+</span></label>
                    <label><input type="checkbox" name="ruleRights" [(ngModel)]="ruleRights" /><span>Ik bezit de rechten</span></label>
                    <label><input type="checkbox" name="ruleSafe" [(ngModel)]="ruleSafe" /><span>Er staan geen minderjarigen op</span></label>
                    <label><input type="checkbox" name="rulePermission" [(ngModel)]="rulePermission" /><span>Alle personen hebben toestemming gegeven</span></label>
                  </fieldset>

                  <button type="submit" [disabled]="isCreating() || !canCreate()">
                    {{ isCreating() ? 'Album aanmaken...' : 'Album aanmaken' }}
                  </button>
                </form>
              }
            </article>

            @if (isLoadingAlbums()) {
              <article class="panel loading-state">Je albums worden geladen...</article>
            } @else if (albums().length === 0) {
              <article class="panel empty-state">
                <div class="empty-icon">+</div>
                <h2>Nog geen albums</h2>
                <p class="muted">Maak je eerste album aan en voeg daarna direct foto's toe.</p>
                <button type="button" (click)="openCreateForm()">Eerste album maken</button>
              </article>
            } @else {
              <div class="album-list">
                @for (album of albums(); track album.id) {
                  <article class="album-card">
                    <div class="album-header">
                      <div class="album-title">
                        <div class="album-cover">
                          @if (album.assets[0]; as cover) {
                            <img
                              [appAuthenticatedSrc]="cover.url"
                              [previewSrc]="cover.preview_url"
                              alt="Omslag van {{ album.title }}"
                            />
                          } @else {
                            <span>{{ initials(album.title) }}</span>
                          }
                        </div>
                        <div>
                          <div class="status-row">
                            <span class="pill" [class.private]="album.is_private">
                              {{ album.is_private ? 'Privé' : 'Openbaar' }}
                            </span>
                            <span class="muted">{{ album.assets.length }} foto's</span>
                          </div>
                          <h2>{{ album.title }}</h2>
                          @if (album.description) {
                            <p class="muted">{{ album.description }}</p>
                          }
                        </div>
                      </div>
                      <div class="album-actions">
                        <button
                          type="button"
                          class="secondary compact-button"
                          (click)="toggleSettings(album)">
                          {{ editingAlbumId() === album.id ? 'Annuleren' : 'Instellingen' }}
                        </button>
                        <label class="upload-button">
                          <span>{{ uploadingAlbumId() === album.id ? 'Uploaden...' : 'Foto toevoegen' }}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            [disabled]="uploadingAlbumId() === album.id"
                            (change)="uploadPhoto(album.id, $event)"
                          />
                        </label>
                      </div>
                    </div>

                    @if (editingAlbumId() === album.id && albumDrafts[album.id]; as draft) {
                      <form class="album-form settings-form" (ngSubmit)="saveAlbum(album)">
                        <div class="form-grid">
                          <label>
                            Albumtitel
                            <input
                              [name]="'title-' + album.id"
                              [(ngModel)]="draft.title"
                              maxlength="160"
                              required
                            />
                          </label>
                          <label>
                            Zichtbaarheid
                            <select [name]="'privacy-' + album.id" [(ngModel)]="draft.isPrivate">
                              <option [ngValue]="false">Openbaar album</option>
                              <option [ngValue]="true">Privéalbum met toegangsverzoeken</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          Beschrijving
                          <textarea
                            [name]="'description-' + album.id"
                            [(ngModel)]="draft.description"
                            maxlength="1500"
                            rows="3"></textarea>
                        </label>
                        <div class="form-actions">
                          <button type="submit" [disabled]="savingAlbumId() === album.id || !draft.title.trim()">
                            {{ savingAlbumId() === album.id ? 'Opslaan...' : 'Wijzigingen opslaan' }}
                          </button>
                          <button type="button" class="secondary" (click)="toggleSettings(album)">Annuleren</button>
                        </div>
                      </form>
                    }

                    @if (album.assets.length === 0) {
                      <label class="album-dropzone">
                        <strong>Voeg de eerste foto toe</strong>
                        <span>JPG, PNG, WebP of GIF tot 10 MB</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          [disabled]="uploadingAlbumId() === album.id"
                          (change)="uploadPhoto(album.id, $event)"
                        />
                      </label>
                    } @else {
                      <div class="photo-grid">
                        @for (asset of album.assets; track asset.id) {
                          <figure class="photo-card" [class.hidden-photo]="asset.hidden">
                            <img
                              [appAuthenticatedSrc]="asset.url"
                              [previewSrc]="asset.preview_url"
                              alt="Foto in {{ album.title }}"
                            />
                            <figcaption>
                              <span>{{ asset.hidden ? 'Verborgen' : 'Zichtbaar' }}</span>
                              <button
                                type="button"
                                class="icon-button"
                                [attr.aria-label]="asset.hidden ? 'Foto weergeven' : 'Foto verbergen'"
                                [title]="asset.hidden ? 'Foto weergeven' : 'Foto verbergen'"
                                (click)="togglePhoto(album, asset.id)">
                                @if (asset.hidden) {
                                  <span aria-hidden="true">◉</span>
                                } @else {
                                  <span aria-hidden="true">○</span>
                                }
                              </button>
                            </figcaption>
                          </figure>
                        }
                      </div>
                    }
                  </article>
                }
              </div>
            }
          </section>

          <aside class="request-column">
            <article class="panel requests-panel">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Toegang</p>
                  <h2>Fotoverzoeken</h2>
                </div>
                @if (pendingRequestCount() > 0) {
                  <span class="request-count">{{ pendingRequestCount() }}</span>
                }
              </div>
              <p class="muted">Bepaal wie je privéalbums volledig mag bekijken.</p>

              @if (isLoadingRequests()) {
                <p>Verzoeken laden...</p>
              } @else if (accessRequests().length === 0) {
                <div class="empty-request">
                  <strong>Geen verzoeken</strong>
                  <span>Nieuwe aanvragen verschijnen hier.</span>
                </div>
              } @else {
                <div class="request-list">
                  @for (request of accessRequests(); track request.id) {
                    <article class="request-card">
                      <div>
                        <strong>{{ request.requester_display_name || 'Onbekend profiel' }}</strong>
                        <p>{{ request.post_title }}</p>
                        <span class="pill">{{ statusLabel(request.status) }}</span>
                      </div>
                      @if (request.status === 'pending') {
                        <div class="request-actions">
                          <button type="button" (click)="decideAccess(request, 'approve')">Toestaan</button>
                          <button type="button" class="secondary" (click)="decideAccess(request, 'deny')">Weigeren</button>
                        </div>
                      }
                    </article>
                  }
                </div>
              }
            </article>

            <article class="panel help-panel">
              <h2>Hoe zichtbaarheid werkt</h2>
              <div class="help-row">
                <span class="help-dot public"></span>
                <div><strong>Openbaar</strong><p>Foto's zijn zichtbaar volgens het accountniveau van de bezoeker.</p></div>
              </div>
              <div class="help-row">
                <span class="help-dot private"></span>
                <div><strong>Privé</strong><p>Je keurt per persoon goed wie de volledige foto's mag zien.</p></div>
              </div>
              <div class="help-row">
                <span class="help-dot hidden"></span>
                <div><strong>Verborgen foto</strong><p>De foto blijft in je album, maar verschijnt niet op je publieke profiel.</p></div>
              </div>
            </article>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [`
    .photos-page { display: grid; gap: 1rem; }
    .hero { display: flex; justify-content: space-between; gap: 1.5rem; align-items: center; padding: clamp(1.25rem, 3vw, 2rem); border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.5rem; background: radial-gradient(circle at 88% 10%, rgba(236, 72, 153, .18), transparent 30%), linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(2, 6, 23, .98)); box-shadow: 0 24px 55px rgba(0, 0, 0, .28); }
    .hero h1 { margin: .2rem 0 .55rem; }
    .lead { max-width: 650px; margin: 0; color: #cbd5e1; line-height: 1.6; }
    .eyebrow { margin: 0; color: #f59e0b; font-weight: 900; text-transform: uppercase; letter-spacing: .09em; font-size: .84rem; }
    .hero-summary { display: grid; grid-template-columns: repeat(3, minmax(80px, 1fr)); min-width: min(340px, 100%); border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.15rem; overflow: hidden; background: rgba(15, 23, 42, .62); }
    .hero-summary div { display: grid; gap: .15rem; padding: .9rem; text-align: center; border-left: 1px solid rgba(148, 163, 184, .12); }
    .hero-summary div:first-child { border-left: 0; }
    .hero-summary strong { font-size: 1.35rem; color: #f8fafc; }
    .hero-summary span { color: #94a3b8; font-size: .78rem; }
    .dashboard { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 340px); gap: 1rem; align-items: start; }
    .album-column, .request-column, .album-list { display: grid; gap: 1rem; }
    .request-column { position: sticky; top: 6rem; }
    .panel, .album-card { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.1rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .97)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .2); }
    .section-heading, .album-header, .album-title, .album-actions, .status-row, .form-actions, .request-actions { display: flex; gap: .75rem; align-items: center; }
    .section-heading, .album-header { justify-content: space-between; align-items: flex-start; }
    .section-heading h2, .album-title h2, .help-panel h2 { margin: .2rem 0 0; }
    .album-title { align-items: flex-start; min-width: 0; }
    .album-title > div:last-child { min-width: 0; }
    .album-title h2 { overflow-wrap: anywhere; }
    .album-title p { margin: .35rem 0 0; }
    .album-cover { display: grid; place-items: center; flex: 0 0 auto; width: 4.5rem; height: 4.5rem; overflow: hidden; border-radius: 1rem; background: linear-gradient(135deg, #f59e0b, #ec4899 55%, #38bdf8); font-size: 1.2rem; font-weight: 900; }
    .album-cover img { width: 100%; height: 100%; object-fit: cover; }
    .album-actions { flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; }
    .album-form { display: grid; gap: 1rem; margin-top: 1rem; }
    .settings-form { padding: 1rem; border-radius: 1rem; border: 1px solid rgba(244, 114, 182, .2); background: rgba(76, 29, 149, .1); }
    .form-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, .65fr); gap: .85rem; }
    label { display: grid; gap: .38rem; color: #cbd5e1; font-weight: 700; }
    input, textarea, select { width: 100%; border: 1px solid rgba(148, 163, 184, .22); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    textarea { resize: vertical; }
    .toggle-row { display: flex; align-items: flex-start; gap: .75rem; padding: .85rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: .9rem; background: rgba(15, 23, 42, .52); }
    .toggle-row input, .consent-grid input { width: 1.15rem; height: 1.15rem; flex: 0 0 auto; margin-top: .15rem; accent-color: #ec4899; }
    .toggle-row span { display: grid; gap: .2rem; }
    .toggle-row small { color: #94a3b8; font-weight: 400; line-height: 1.4; }
    .consent-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; margin: 0; padding: 1rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: 1rem; }
    .consent-grid legend { padding: 0 .35rem; color: #f8fafc; font-weight: 800; }
    .consent-grid label { display: flex; align-items: flex-start; gap: .55rem; padding: .65rem; border-radius: .75rem; background: rgba(15, 23, 42, .5); font-weight: 600; line-height: 1.4; }
    .upload-button, .album-dropzone { cursor: pointer; }
    .upload-button { display: inline-flex; justify-content: center; align-items: center; min-height: 2.5rem; padding: .65rem .9rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #f472b6); color: #111827; font-weight: 900; }
    .upload-button input, .album-dropzone input { display: none; }
    .compact-button { width: auto; min-height: 2.5rem; padding: .65rem .85rem; }
    .album-dropzone { display: grid; justify-items: center; gap: .3rem; margin-top: 1rem; padding: 1.5rem; border: 1px dashed rgba(244, 114, 182, .35); border-radius: 1rem; background: rgba(76, 29, 149, .08); text-align: center; }
    .album-dropzone span { color: #94a3b8; font-size: .88rem; }
    .photo-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .7rem; margin-top: 1rem; }
    .photo-card { position: relative; overflow: hidden; margin: 0; border: 1px solid rgba(148, 163, 184, .14); border-radius: .95rem; background: #020617; }
    .photo-card img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
    .photo-card figcaption { position: absolute; inset: auto 0 0; display: flex; justify-content: space-between; align-items: center; gap: .5rem; padding: 1.8rem .55rem .5rem; background: linear-gradient(transparent, rgba(2, 6, 23, .94)); color: #e2e8f0; font-size: .78rem; font-weight: 800; }
    .hidden-photo img { opacity: .38; filter: grayscale(.7); }
    .icon-button { width: 2rem; min-width: 2rem; height: 2rem; min-height: 2rem; padding: 0; border: 1px solid rgba(255, 255, 255, .16); background: rgba(15, 23, 42, .86); color: #f8fafc; box-shadow: none; }
    .pill { display: inline-flex; width: fit-content; padding: .3rem .58rem; border: 1px solid rgba(148, 163, 184, .18); border-radius: 999px; background: rgba(148, 163, 184, .1); color: #cbd5e1; font-size: .78rem; font-weight: 800; }
    .pill.private { color: #f9a8d4; border-color: rgba(244, 114, 182, .28); }
    .muted { color: #94a3b8; }
    .notice { margin: 0; padding: .8rem 1rem; border-radius: .8rem; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); }
    .request-count { display: grid; place-items: center; min-width: 2rem; height: 2rem; padding: 0 .5rem; border-radius: 999px; background: #ec4899; color: white; font-weight: 900; }
    .request-list { display: grid; gap: .75rem; margin-top: 1rem; }
    .request-card { display: grid; gap: .75rem; padding-top: .8rem; border-top: 1px solid rgba(148, 163, 184, .14); }
    .request-card:first-child { padding-top: 0; border-top: 0; }
    .request-card p { margin: .25rem 0 .5rem; color: #94a3b8; }
    .request-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .request-actions button { width: 100%; min-height: 2.5rem; padding: .65rem; }
    .empty-request, .empty-state, .loading-state { display: grid; justify-items: center; gap: .45rem; text-align: center; padding-block: 1.5rem; }
    .empty-request { justify-items: start; padding: .85rem; border-radius: .8rem; background: rgba(15, 23, 42, .5); text-align: left; }
    .empty-request span { color: #94a3b8; font-size: .9rem; }
    .empty-icon { display: grid; place-items: center; width: 3rem; height: 3rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #f472b6); color: #111827; font-size: 1.5rem; font-weight: 900; }
    .help-panel { display: grid; gap: .9rem; }
    .help-row { display: flex; gap: .7rem; align-items: flex-start; }
    .help-row p { margin: .2rem 0 0; color: #94a3b8; font-size: .88rem; line-height: 1.45; }
    .help-dot { flex: 0 0 auto; width: .7rem; height: .7rem; margin-top: .3rem; border-radius: 999px; }
    .help-dot.public { background: #22c55e; }
    .help-dot.private { background: #ec4899; }
    .help-dot.hidden { background: #64748b; }
    .age-gate { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .secondary-link { display: inline-flex; justify-content: center; align-items: center; padding: .75rem 1rem; border: 1px solid rgba(148, 163, 184, .24); border-radius: 999px; background: rgba(15, 23, 42, .9); color: #f8fafc; text-decoration: none; font-weight: 800; white-space: nowrap; }
    @media (max-width: 1020px) {
      .dashboard { grid-template-columns: 1fr; }
      .request-column { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .photo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      .hero, .album-header, .age-gate { display: grid; }
      .hero-summary { min-width: 0; width: 100%; }
      .album-actions { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .album-actions > * { width: 100%; }
      .form-grid, .request-column { grid-template-columns: 1fr; }
      .photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 520px) {
      .hero, .panel, .album-card { border-radius: 1rem; }
      .hero-summary div { padding: .7rem .35rem; }
      .album-title { display: grid; grid-template-columns: auto minmax(0, 1fr); }
      .album-cover { width: 3.75rem; height: 3.75rem; }
      .consent-grid, .form-actions { display: grid; grid-template-columns: 1fr; }
      .form-actions button { width: 100%; }
      .photo-grid { gap: .5rem; }
    }
  `]
})
export class MyPhotosPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly albums = signal<Post[]>([]);
  protected readonly accessRequests = signal<PostAccessRequest[]>([]);
  protected readonly isLoadingAlbums = signal(true);
  protected readonly isLoadingRequests = signal(true);
  protected readonly isCreateFormOpen = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly uploadingAlbumId = signal<string | null>(null);
  protected readonly savingAlbumId = signal<string | null>(null);
  protected readonly editingAlbumId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly albumDrafts: Record<string, AlbumDraft> = {};
  protected newTitle = '';
  protected newDescription = '';
  protected newPrivate = false;
  protected ruleAge = true;
  protected ruleRights = true;
  protected ruleSafe = true;
  protected rulePermission = true;

  public ngOnInit(): void {
    const user = this.session.user();
    if (!user?.age_confirmed) {
      this.isLoadingAlbums.set(false);
      this.isLoadingRequests.set(false);
      return;
    }
    this.loadAlbums(user.id);
    this.loadRequests();
  }

  protected photoCount(): number {
    return this.albums().reduce((total, album) => total + album.assets.length, 0);
  }

  protected pendingRequestCount(): number {
    return this.accessRequests().filter(request => request.status === 'pending').length;
  }

  protected canCreate(): boolean {
    return !!this.newTitle.trim() && this.ruleAge && this.ruleRights && this.ruleSafe && this.rulePermission;
  }

  protected toggleCreateForm(): void {
    this.isCreateFormOpen.update(value => !value);
  }

  protected openCreateForm(): void {
    this.isCreateFormOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected createAlbum(): void {
    this.isCreating.set(true);
    this.clearNotices();
    this.api.createPost({
      title: this.newTitle.trim(),
      description: this.newDescription.trim() || null,
      is_private: this.newPrivate,
      rule_age: this.ruleAge,
      rule_rights: this.ruleRights,
      rule_safe: this.ruleSafe,
      rule_permission: this.rulePermission
    }).subscribe({
      next: album => {
        this.albums.update(items => [album, ...items]);
        this.newTitle = '';
        this.newDescription = '';
        this.newPrivate = false;
        this.isCreateFormOpen.set(false);
        this.isCreating.set(false);
        this.success.set("Album aangemaakt. Je kunt nu foto's toevoegen.");
      },
      error: () => {
        this.error.set('Album aanmaken is niet gelukt. Controleer de invoer en bevestigingen.');
        this.isCreating.set(false);
      }
    });
  }

  protected toggleSettings(album: Post): void {
    if (this.editingAlbumId() === album.id) {
      this.editingAlbumId.set(null);
      return;
    }
    this.albumDrafts[album.id] = {
      title: album.title,
      description: album.description || '',
      isPrivate: album.is_private
    };
    this.editingAlbumId.set(album.id);
  }

  protected saveAlbum(album: Post): void {
    const draft = this.albumDrafts[album.id];
    if (!draft?.title.trim()) {
      return;
    }
    this.savingAlbumId.set(album.id);
    this.clearNotices();
    this.api.updatePost(album.id, {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      is_private: draft.isPrivate
    }).subscribe({
      next: updated => {
        this.albums.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.editingAlbumId.set(null);
        this.savingAlbumId.set(null);
        this.success.set('Albuminstellingen opgeslagen.');
      },
      error: () => {
        this.error.set('Albuminstellingen opslaan is niet gelukt.');
        this.savingAlbumId.set(null);
      }
    });
  }

  protected uploadPhoto(albumId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadingAlbumId.set(albumId);
    this.clearNotices();
    this.api.uploadPostAsset(albumId, file).subscribe({
      next: ({ post }) => {
        this.albums.update(items => items.map(item => item.id === post.id ? post : item));
        this.uploadingAlbumId.set(null);
        input.value = '';
        this.success.set('Foto toegevoegd.');
      },
      error: () => {
        this.error.set('Uploaden is niet gelukt. Gebruik JPG, PNG, WebP of GIF tot 10 MB.');
        this.uploadingAlbumId.set(null);
        input.value = '';
      }
    });
  }

  protected togglePhoto(album: Post, assetId: string): void {
    this.clearNotices();
    this.api.toggleAssetVisibility(assetId).subscribe({
      next: updated => {
        this.albums.update(items => items.map(item => item.id === album.id ? updated : item));
        this.success.set('Fotozichtbaarheid bijgewerkt.');
      },
      error: () => this.error.set('Fotozichtbaarheid aanpassen is niet gelukt.')
    });
  }

  protected decideAccess(request: PostAccessRequest, decision: 'approve' | 'deny'): void {
    this.clearNotices();
    this.api.decidePostAccess(request.id, decision).subscribe({
      next: updated => {
        this.accessRequests.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.success.set(decision === 'approve' ? 'Toegang toegestaan.' : 'Toegang geweigerd.');
      },
      error: () => this.error.set('Het fotoverzoek kon niet worden bijgewerkt.')
    });
  }

  protected statusLabel(status: PostAccessRequest['status']): string {
    if (status === 'approved') return 'Toegestaan';
    if (status === 'denied') return 'Geweigerd';
    return 'In afwachting';
  }

  protected initials(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  }

  private loadAlbums(userId: string): void {
    this.api.getPosts({ userId }).subscribe({
      next: albums => {
        this.albums.set(albums);
        this.isLoadingAlbums.set(false);
      },
      error: () => {
        this.error.set('Albums laden is niet gelukt.');
        this.isLoadingAlbums.set(false);
      }
    });
  }

  private loadRequests(): void {
    this.api.getIncomingPostAccessRequests().subscribe({
      next: requests => {
        this.accessRequests.set(requests);
        this.isLoadingRequests.set(false);
      },
      error: () => {
        this.accessRequests.set([]);
        this.isLoadingRequests.set(false);
      }
    });
  }

  private clearNotices(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
