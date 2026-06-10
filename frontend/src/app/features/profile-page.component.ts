import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Post, Profile, ProfileVisitSummary, ReportItem } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card flow">
      <div class="title-row">
        <div>
          <p class="eyebrow">Profiel</p>
          <h1>Jouw profiel en foto's</h1>
          <p>Bouw je zichtbare profiel uit, beheer je gallery en volg wie je profiel recent heeft bekeken.</p>
        </div>
        @if (profile(); as item) {
          <a [routerLink]="['/discover', item.slug]" class="secondary-link public-profile-link">Bekijk publiek profiel</a>
        }
      </div>

      @if (!session.isLoggedIn()) {
        <p>Log eerst in om je profiel te beheren.</p>
        <a routerLink="/login">Naar login</a>
      } @else {
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        @if (success()) {
          <p class="success">{{ success() }}</p>
        }

        <div class="layout">
          <div class="main-column">
            <form class="form panel" (ngSubmit)="saveProfile()">
              <h2>Over jou</h2>

              <label>
                Weergavenaam
                <input name="displayName" [(ngModel)]="displayName" maxlength="80" required />
              </label>

              <label>
                Locatie
                <input name="locationLabel" [(ngModel)]="locationLabel" maxlength="120" placeholder="Bijv. Utrecht" />
              </label>

              <div class="duo">
                <label>
                  Leeftijdslabel
                  <input name="ageLabel" [(ngModel)]="ageLabel" maxlength="40" placeholder="Bijv. 29" />
                </label>

                <label>
                  Gender
                  <input name="gender" [(ngModel)]="gender" maxlength="80" placeholder="Bijv. vrouw" />
                </label>
              </div>

              <label>
                Korte beschrijving
                <textarea name="bio" [(ngModel)]="bio" maxlength="1000" rows="6"></textarea>
              </label>

              <button type="submit" [disabled]="isSavingProfile() || !displayName.trim()">
                {{ isSavingProfile() ? 'Opslaan...' : 'Profiel opslaan' }}
              </button>
            </form>

            <article class="panel">
              <div class="gallery-head">
                <div>
                  <h2>Mijn foto's</h2>
                  <p class="muted">Deze foto's verschijnen op je publieke profielpagina.</p>
                </div>
              </div>

              @if (!session.user()?.age_confirmed) {
                <div class="gate">
                  <p>Bevestig eerst je leeftijd voordat je foto's kunt uploaden.</p>
                  <a routerLink="/age" class="secondary-link">Leeftijd bevestigen</a>
                </div>
              } @else {
                <form class="form compact" (ngSubmit)="createPost()">
                  <label>
                    Titel
                    <input name="postTitle" [(ngModel)]="postTitle" maxlength="120" required />
                  </label>

                  <label>
                    Beschrijving
                    <textarea name="postDescription" [(ngModel)]="postDescription" maxlength="1200" rows="3"></textarea>
                  </label>

                  <div class="checks">
                    <label><input type="checkbox" name="ruleAge" [(ngModel)]="ruleAge" /><span>18+ bevestigd</span></label>
                    <label><input type="checkbox" name="ruleRights" [(ngModel)]="ruleRights" /><span>Rechten zijn van mij</span></label>
                    <label><input type="checkbox" name="ruleSafe" [(ngModel)]="ruleSafe" /><span>Geen minderjarigen</span></label>
                    <label><input type="checkbox" name="rulePermission" [(ngModel)]="rulePermission" /><span>Toestemming bevestigd</span></label>
                  </div>

                  <button type="submit" [disabled]="isSavingPost() || !canCreatePost()">
                    {{ isSavingPost() ? 'Aanmaken...' : 'Fotoalbum aanmaken' }}
                  </button>
                </form>

                @if (isLoadingGallery()) {
                  <p>Foto's laden...</p>
                } @else if (gallery().length === 0) {
                  <p class="muted">Nog geen foto's geüpload.</p>
                } @else {
                  <div class="gallery-grid">
                    @for (post of gallery(); track post.id) {
                      <article class="gallery-card">
                        <div class="gallery-card-head">
                          <div>
                            <h3>{{ post.title }}</h3>
                            @if (post.description) { <p class="muted">{{ post.description }}</p> }
                          </div>
                          <label class="upload-label">
                            <span>{{ isUploadingFor(post.id) ? 'Uploaden...' : 'Foto toevoegen' }}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              [disabled]="isUploadingFor(post.id)"
                              (change)="uploadFile(post.id, $event)"
                            />
                          </label>
                        </div>

                        @if (post.assets.length > 0) {
                          <div class="asset-grid">
                            @for (asset of post.assets; track asset.id) {
                              <figure class="asset-item">
                                <img [src]="asset.preview_url || asset.url || ''" alt="Geuploade foto" />
                                <figcaption>
                                  <span class="pill">{{ asset.locked ? 'preview' : 'volledig zichtbaar' }}</span>
                                </figcaption>
                              </figure>
                            }
                          </div>
                        } @else {
                          <p class="muted">Nog geen foto's in deze reeks.</p>
                        }
                      </article>
                    }
                  </div>
                }
              }
            </article>
          </div>

          <div class="side-column">
            @if (profile(); as item) {
              <article class="preview panel">
                <h2>Publieke preview</h2>
                <div class="preview-card">
                  <div class="avatar">{{ initials(item.display_name) }}</div>
                  <div>
                    <h3>{{ item.display_name }}</h3>
                    <p class="muted">/{{ item.slug }}</p>
                  </div>
                </div>

                <div class="meta-row">
                  @if (item.age_label) { <span class="pill">{{ item.age_label }}</span> }
                  @if (item.gender) { <span class="pill">{{ item.gender }}</span> }
                  @if (item.location_label) { <span class="pill">{{ item.location_label }}</span> }
                </div>

                @if (item.bio) {
                  <p>{{ item.bio }}</p>
                } @else {
                  <p class="muted">Nog geen bio toegevoegd.</p>
                }
              </article>
            }

            <article class="panel">
              <div class="activity-head">
                <div>
                  <h2>Profielbezoekers</h2>
                  <p class="muted">Premium toont ook wie je bekeken heeft.</p>
                </div>
              </div>

              @if (activityError()) {
                <p class="error">{{ activityError() }}</p>
              } @else if (isLoadingActivity()) {
                <p>Activiteit laden...</p>
              } @else if (activity(); as summary) {
                <p class="activity-count">{{ summary.count }} bezoek(en) in de recente lijst.</p>
                @if (summary.visits.length === 0) {
                  <p class="muted">Nog geen profielbezoeken geregistreerd.</p>
                } @else {
                  <div class="activity-list">
                    @for (visit of summary.visits; track visit.id) {
                      <div class="activity-item">
                        <div>
                          @if (visit.profile) {
                            <strong>{{ visit.profile.display_name }}</strong>
                            <p class="muted">/{{ visit.profile.slug }}</p>
                          } @else {
                            <strong>Anonieme bezoekmelding</strong>
                            <p class="muted">Upgrade naar premium voor naam en profiel.</p>
                          }
                        </div>
                        <span>{{ formatDate(visit.visited_at) }}</span>
                      </div>
                    }
                  </div>
                }
              }
            </article>

            <article class="panel">
              <div class="activity-head">
                <div>
                  <h2>Mijn meldingen</h2>
                  <p class="muted">Een overzicht van reports die je zelf hebt gedaan.</p>
                </div>
              </div>

              @if (isLoadingReports()) {
                <p>Meldingen laden...</p>
              } @else if (myReports().length === 0) {
                <p class="muted">Je hebt nog geen meldingen gedaan.</p>
              } @else {
                <div class="activity-list">
                  @for (report of myReports(); track report.id) {
                    <div class="activity-item">
                      <div>
                        <strong>{{ report.target_type }} · {{ report.reason.replaceAll('_', ' ') }}</strong>
                        @if (report.description) {
                          <p class="muted">{{ report.description }}</p>
                        } @else {
                          <p class="muted">Geen extra toelichting toegevoegd.</p>
                        }
                      </div>
                      <span class="pill">{{ report.status }}</span>
                    </div>
                  }
                </div>
              }
            </article>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; }
    .title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .secondary-link { display: inline-flex; align-items: center; padding: .78rem 1rem; border-radius: 999px; border: 1px solid rgba(148, 163, 184, .2); background: rgba(15, 23, 42, .85); color: #e2e8f0; text-decoration: none; font-weight: 700; }
    .secondary-link:hover { border-color: rgba(251, 191, 36, .45); color: #f8fafc; }
    .public-profile-link { flex: 0 0 auto; width: auto; white-space: nowrap; }
    .eyebrow { color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, .85fr); gap: 1rem; align-items: start; }
    .main-column, .side-column { display: grid; gap: 1rem; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.1rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .24); }
    .form { display: grid; gap: 1rem; }
    .compact { margin-top: 1rem; }
    .form h2, .panel h2, .panel h3 { margin-top: 0; }
    label { display: grid; gap: .35rem; color: #cbd5e1; font-weight: 600; }
    input, textarea { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    textarea { resize: vertical; }
    .duo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
    .checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; }
    .checks label { display: flex; align-items: center; gap: .65rem; min-width: 0; padding: .7rem .8rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: .8rem; background: rgba(15, 23, 42, .58); cursor: pointer; }
    .checks input[type="checkbox"] { flex: 0 0 auto; width: 1.2rem; height: 1.2rem; margin: 0; padding: 0; accent-color: #ec4899; }
    .checks span { min-width: 0; line-height: 1.35; }
    .preview-card { display: flex; gap: .9rem; align-items: center; }
    .avatar { display: grid; place-items: center; width: 3.5rem; height: 3.5rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899 50%, #38bdf8); color: white; font-weight: 900; flex: 0 0 auto; box-shadow: 0 10px 24px rgba(236, 72, 153, .18); }
    .muted { color: #94a3b8; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .3rem .7rem; font-size: .92rem; font-weight: 700; }
    .gallery-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .gallery-grid { display: grid; gap: 1rem; margin-top: 1rem; }
    .gallery-card { display: grid; gap: .9rem; padding-top: 1rem; border-top: 1px solid rgba(148, 163, 184, .14); }
    .gallery-card:first-child { border-top: 0; padding-top: 0; }
    .gallery-card-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .upload-label { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; padding: .8rem 1rem; border-radius: 999px; border: 1px solid rgba(148, 163, 184, .24); background: #0f172a; color: #f8fafc; cursor: pointer; font-weight: 700; }
    .upload-label input { display: none; }
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; }
    .asset-item { margin: 0; display: grid; gap: .65rem; }
    .asset-item img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: .9rem; border: 1px solid rgba(148, 163, 184, .16); background: #020617; }
    .gate { display: grid; gap: .75rem; padding: 1rem; border: 1px dashed rgba(148, 163, 184, .22); border-radius: 1rem; background: rgba(15, 23, 42, .45); }
    .activity-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .activity-head p { margin: .2rem 0 0; }
    .activity-count { margin-bottom: .9rem; color: #cbd5e1; }
    .activity-list { display: grid; gap: .75rem; }
    .activity-item { display: flex; justify-content: space-between; gap: 1rem; padding-top: .75rem; border-top: 1px solid rgba(148, 163, 184, .14); }
    .activity-item:first-child { border-top: 0; padding-top: 0; }
    .activity-item p { margin: .15rem 0 0; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .title-row, .gallery-card-head, .activity-item { display: grid; }
      .duo, .checks { grid-template-columns: 1fr; }
      .public-profile-link { justify-self: start; }
    }
  `]
})
export class ProfilePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly gallery = signal<Post[]>([]);
  protected readonly activity = signal<ProfileVisitSummary | null>(null);
  protected readonly myReports = signal<ReportItem[]>([]);
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingPost = signal(false);
  protected readonly isLoadingActivity = signal(false);
  protected readonly isLoadingGallery = signal(false);
  protected readonly isLoadingReports = signal(false);
  protected readonly uploadingPostId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly activityError = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected displayName = '';
  protected locationLabel = '';
  protected ageLabel = '';
  protected gender = '';
  protected bio = '';

  protected postTitle = '';
  protected postDescription = '';
  protected ruleAge = true;
  protected ruleRights = true;
  protected ruleSafe = true;
  protected rulePermission = true;

  public ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      return;
    }

    this.api.getMyProfile().subscribe({
      next: profile => {
        this.applyProfile(profile);
        this.loadGallery(profile.user_id);
      },
      error: () => {
        const user = this.session.user();
        this.displayName = user?.email.split('@')[0] ?? '';
      }
    });

    this.loadActivity();
    this.loadReports();
  }

  protected canCreatePost(): boolean {
    return !!this.postTitle.trim() && this.ruleAge && this.ruleRights && this.ruleSafe && this.rulePermission;
  }

  protected isUploadingFor(postId: string): boolean {
    return this.uploadingPostId() === postId;
  }

  protected saveProfile(): void {
    this.isSavingProfile.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.saveMyProfile({
      display_name: this.displayName.trim(),
      location_label: this.locationLabel.trim() || null,
      age_label: this.ageLabel.trim() || null,
      gender: this.gender.trim() || null,
      bio: this.bio.trim() || null
    }).subscribe({
      next: profile => {
        this.applyProfile(profile);
        this.success.set('Profiel opgeslagen.');
        this.isSavingProfile.set(false);
      },
      error: () => {
        this.error.set('Opslaan is niet gelukt. Controleer je invoer en probeer opnieuw.');
        this.isSavingProfile.set(false);
      }
    });
  }

  protected createPost(): void {
    this.isSavingPost.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.createPost({
      title: this.postTitle.trim(),
      description: this.postDescription.trim() || null,
      rule_age: this.ruleAge,
      rule_rights: this.ruleRights,
      rule_safe: this.ruleSafe,
      rule_permission: this.rulePermission
    }).subscribe({
      next: post => {
        this.gallery.set([post, ...this.gallery()]);
        this.postTitle = '';
        this.postDescription = '';
        this.success.set('Fotoalbum aangemaakt. Voeg nu je eerste foto toe.');
        this.isSavingPost.set(false);
      },
      error: () => {
        this.error.set('Fotoalbum aanmaken is niet gelukt. Controleer of alle regels zijn aangevinkt.');
        this.isSavingPost.set(false);
      }
    });
  }

  protected uploadFile(postId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploadingPostId.set(postId);
    this.error.set(null);
    this.success.set(null);

    this.api.uploadPostAsset(postId, file).subscribe({
      next: ({ post }) => {
        this.gallery.set(this.gallery().map(item => item.id === post.id ? post : item));
        this.success.set('Foto toegevoegd.');
        this.uploadingPostId.set(null);
        input.value = '';
      },
      error: () => {
        this.error.set('Uploaden is niet gelukt. Gebruik JPG, PNG, WebP of GIF tot 10 MB.');
        this.uploadingPostId.set(null);
        input.value = '';
      }
    });
  }

  protected loadActivity(): void {
    this.isLoadingActivity.set(true);
    this.activityError.set(null);

    this.api.getMyProfileActivity().subscribe({
      next: activity => {
        this.activity.set(activity);
        this.isLoadingActivity.set(false);
      },
      error: () => {
        this.activityError.set('Profielactiviteit laden is niet gelukt.');
        this.isLoadingActivity.set(false);
      }
    });
  }

  protected loadReports(): void {
    this.isLoadingReports.set(true);
    this.api.getMyReports().subscribe({
      next: reports => {
        this.myReports.set(reports);
        this.isLoadingReports.set(false);
      },
      error: () => {
        this.myReports.set([]);
        this.isLoadingReports.set(false);
      }
    });
  }

  private loadGallery(userId: string): void {
    this.isLoadingGallery.set(true);
    this.api.getPosts({ userId }).subscribe({
      next: posts => {
        this.gallery.set(posts);
        this.isLoadingGallery.set(false);
      },
      error: () => {
        this.gallery.set([]);
        this.isLoadingGallery.set(false);
      }
    });
  }

  protected initials(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  private applyProfile(profile: Profile): void {
    this.profile.set(profile);
    this.displayName = profile.display_name;
    this.locationLabel = profile.location_label ?? '';
    this.ageLabel = profile.age_label ?? '';
    this.gender = profile.gender ?? '';
    this.bio = profile.bio ?? '';
  }
}
