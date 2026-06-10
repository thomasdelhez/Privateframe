import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Post, Profile, ReportReason } from '../core/api.service';
import { SessionService } from '../core/session.service';

interface GalleryItem {
  postId: string;
  assetId: string;
  imageUrl: string;
  locked: boolean;
  title: string;
  description: string | null;
  isPrivate: boolean;
  accessStatus: Post['access_status'];
}

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <section class="card flow">
      <a routerLink="/discover" class="back-link">Terug naar ontdekken</a>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      } @else if (isLoading()) {
        <p>Profiel laden...</p>
      } @else if (profile(); as item) {
        <header class="hero">
          <div class="avatar">{{ initials(item.display_name) }}</div>
          <div class="hero-copy">
            <p class="eyebrow">Profiel</p>
            <h1>{{ item.display_name }}</h1>
            <p class="muted">/{{ item.slug }}</p>
            <div class="meta-row">
              @if (item.age_label) {
                <span class="pill">{{ item.age_label }}</span>
              }
              @if (item.gender) {
                <span class="pill">{{ item.gender }}</span>
              }
              @if (item.location_label) {
                <span class="pill">{{ item.location_label }}</span>
              }
            </div>
          </div>
          <div class="hero-actions">
            @if (!isOwnProfile()) {
              <button
                type="button"
                class="profile-action"
                [class.active]="item.is_favorite"
                [attr.aria-label]="item.is_favorite ? 'Verwijder uit favorieten' : 'Bewaar als favoriet'"
                [attr.data-label]="item.is_favorite ? 'Favoriet verwijderen' : 'Favoriet'"
                [title]="item.is_favorite ? 'Verwijder uit favorieten' : 'Bewaar als favoriet'"
                (click)="toggleFavorite()"
                [disabled]="isUpdatingRelationship()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z"></path>
                </svg>
              </button>
              <button
                type="button"
                class="profile-action primary-action"
                [class.active]="item.is_liked"
                [attr.aria-label]="item.is_liked ? 'Like verwijderen' : 'Like profiel'"
                [attr.data-label]="item.is_liked ? 'Like verwijderen' : 'Like'"
                [title]="item.is_liked ? 'Like verwijderen' : 'Like profiel'"
                (click)="toggleLike()"
                [disabled]="isUpdatingRelationship()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path>
                </svg>
              </button>
            }
            @if (!isOwnProfile() && session.isPremium()) {
              <button
                type="button"
                class="profile-action primary-action"
                aria-label="Chat starten"
                data-label="Chat"
                title="Chat starten"
                (click)="startConversation()"
                [disabled]="isStartingConversation()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"></path>
                </svg>
              </button>
            }
            @if (!isOwnProfile()) {
              <button
                type="button"
                class="profile-action"
                [class.active]="isReportComposerOpen()"
                [attr.aria-label]="isReportComposerOpen() ? 'Melding annuleren' : 'Profiel melden'"
                [attr.data-label]="isReportComposerOpen() ? 'Annuleren' : 'Melden'"
                [title]="isReportComposerOpen() ? 'Melding annuleren' : 'Profiel melden'"
                (click)="toggleReportComposer()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 21V4m0 0h11l-1 4 4 2-2 5H4"></path>
                </svg>
              </button>
              <button
                type="button"
                class="profile-action danger-action"
                aria-label="Profiel blokkeren"
                data-label="Blokkeren"
                title="Profiel blokkeren"
                (click)="blockProfile()"
                [disabled]="isUpdatingRelationship()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="m5.65 5.65 12.7 12.7"></path>
                </svg>
              </button>
            }
          </div>
        </header>

        @if (actionSuccess()) {
          <p class="success">{{ actionSuccess() }}</p>
        }

        @if (isReportComposerOpen()) {
          <article class="panel">
            <h2>Profiel melden</h2>
            <form class="report-form" (ngSubmit)="submitProfileReport()">
              <label>
                Reden
                <select name="reportReason" [(ngModel)]="reportReason">
                  @for (option of reportReasons; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </label>

              <label>
                Toelichting
                <textarea
                  name="reportDescription"
                  [(ngModel)]="reportDescription"
                  rows="4"
                  maxlength="600"
                  placeholder="Geef kort door wat er mis is op dit profiel."></textarea>
              </label>

              <button type="submit" [disabled]="isSubmittingReport()">
                {{ isSubmittingReport() ? 'Verzenden...' : 'Melding versturen' }}
              </button>
            </form>
          </article>
        }

        <div class="details-grid">
          <article class="panel">
            <h2>Over {{ item.display_name }}</h2>
            <p>{{ item.bio || 'Nog geen beschrijving ingevuld.' }}</p>
          </article>
          @if (item.interests.length > 0) {
            <article class="panel">
              <h2>Interesses</h2>
              <div class="meta-row">
                @for (interest of item.interests; track interest) {
                  <span class="pill">{{ interest }}</span>
                }
              </div>
            </article>
          }

          <article class="panel">
            <h2>Profiel</h2>
            <p>Laatst bijgewerkt: {{ formatDate(item.updated_at) }}</p>
            <p>
              @if (item.last_active_at) {
                Laatst actief: {{ formatDate(item.last_active_at) }}
              } @else {
                Nog geen recente activiteit beschikbaar.
              }
            </p>
          </article>
        </div>

        <article class="panel gallery">
          <div class="gallery-head">
            <div>
              <h2>Foto's</h2>
              <p class="muted">
                @if (galleryItems().length > 0) {
                  {{ galleryItems().length }} upload(s) zichtbaar op dit profiel.
                } @else {
                  Nog geen foto's toegevoegd.
                }
              </p>
            </div>
          </div>

          @if (isLoadingGallery()) {
            <p>Foto's laden...</p>
          } @else if (galleryItems().length === 0) {
            <p class="muted">Deze gebruiker heeft nog geen foto's gedeeld.</p>
          } @else {
            @for (album of privateAlbums(); track album.id) {
              <div class="access-card">
                <div>
                  <strong>{{ album.title }}</strong>
                  <p class="muted">Privéalbum · {{ accessStatusLabel(album.access_status) }}</p>
                </div>
                @if (!album.access_status || album.access_status === 'denied') {
                  <button type="button" class="secondary compact-button" (click)="requestAccess(album)">
                    Toegang aanvragen
                  </button>
                }
              </div>
            }
            <div class="gallery-grid">
              @for (item of galleryItems(); track item.assetId; let index = $index) {
                <button type="button" class="gallery-item" (click)="openLightbox(index)">
                  <img [src]="item.imageUrl" alt="Foto van {{ profile()?.display_name }}" />
                  <span class="gallery-badge">{{ item.locked ? 'preview' : 'volledig' }}</span>
                  <span class="gallery-title">{{ item.title }}</span>
                </button>
              }
            </div>
          }
        </article>
      }
    </section>

    @if (activeItem(); as item) {
      <div class="lightbox-backdrop" (click)="closeLightbox()">
        <div class="lightbox" (click)="$event.stopPropagation()">
          <button type="button" class="lightbox-close" (click)="closeLightbox()">Sluiten</button>

          <div class="lightbox-media" (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
            <button
              type="button"
              class="lightbox-nav"
              (click)="showPrevious()"
              [disabled]="activeIndex() === 0">
              Vorige
            </button>

            <figure class="lightbox-figure">
              <img [src]="item.imageUrl" alt="Foto van {{ profile()?.display_name }}" />
              <figcaption>
                <div class="caption-row">
                  <strong>{{ item.title }}</strong>
                  <span class="pill">{{ item.locked ? 'preview' : 'volledige foto' }}</span>
                </div>
                @if (item.description) {
                  <p>{{ item.description }}</p>
                }
                @if (item.locked) {
                  <p class="muted">
                    {{ item.isPrivate ? 'Vraag toegang tot dit privéalbum aan.' : 'De volledige foto is zichtbaar met premium.' }}
                  </p>
                }
              </figcaption>
            </figure>

            <button
              type="button"
              class="lightbox-nav"
              (click)="showNext()"
              [disabled]="activeIndex() === galleryItems().length - 1">
              Volgende
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .flow { display: grid; gap: 1.25rem; }
    .back-link { color: #fbbf24; text-decoration: none; font-weight: 700; }
    .hero { display: flex; gap: 1rem; align-items: center; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(30, 41, 59, .92) 55%, rgba(9, 9, 11, .94)); border: 1px solid rgba(148, 163, 184, .14); color: #f8fafc; }
    .avatar { display: grid; place-items: center; width: 4.75rem; height: 4.75rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899 50%, #38bdf8); color: white; font-size: 1.35rem; font-weight: 900; flex: 0 0 auto; }
    .hero-copy { display: grid; gap: .35rem; }
    .hero-actions { position: relative; margin-left: auto; display: flex; flex-wrap: nowrap; gap: .55rem; align-items: center; }
    .profile-action { position: relative; width: 3rem; min-width: 3rem; min-height: 3rem; height: 3rem; padding: 0; border: 1px solid rgba(148, 163, 184, .25); background: rgba(15, 23, 42, .9); color: #e2e8f0; box-shadow: none; }
    .profile-action svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    .profile-action:hover { border-color: rgba(244, 114, 182, .55); color: #f9a8d4; }
    .profile-action.primary-action { background: linear-gradient(135deg, rgba(245, 158, 11, .2), rgba(244, 114, 182, .2)); }
    .profile-action.active { border-color: rgba(244, 114, 182, .7); background: linear-gradient(135deg, #f59e0b, #f472b6); color: #111827; }
    .profile-action.active svg { fill: currentColor; }
    .profile-action.danger-action { background: rgba(127, 29, 29, .3); color: #fecaca; border-color: rgba(248, 113, 113, .25); }
    .profile-action.danger-action:hover { border-color: rgba(248, 113, 113, .55); color: #fee2e2; }
    @media (hover: hover) {
      .profile-action::after { content: attr(data-label); position: absolute; z-index: 5; top: calc(100% + .55rem); left: 50%; transform: translateX(-50%); pointer-events: none; opacity: 0; padding: .38rem .55rem; border-radius: .5rem; background: #020617; border: 1px solid rgba(148, 163, 184, .2); color: #f8fafc; font-size: .75rem; font-weight: 700; white-space: nowrap; transition: opacity .14s ease; }
      .profile-action:hover::after, .profile-action:focus-visible::after { opacity: 1; }
    }
    .eyebrow { margin: 0; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .muted { color: #94a3b8; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .35rem .7rem; font-size: .95rem; font-weight: 700; }
    .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.2rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; }
    .panel h2 { margin-top: 0; }
    .gallery-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
    .access-card { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: .75rem; padding: .85rem; border: 1px solid rgba(244, 114, 182, .2); border-radius: 1rem; background: rgba(76, 29, 149, .12); }
    .access-card p { margin: .2rem 0 0; }
    .compact-button { width: auto; }
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .gallery-item { position: relative; display: grid; gap: .65rem; margin: 0; padding: 0; border: 0; background: transparent; text-align: left; }
    .gallery-item img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: .9rem; border: 1px solid rgba(148, 163, 184, .16); background: #020617; transition: transform .18s ease, border-color .18s ease; }
    .gallery-item:hover img { transform: translateY(-2px); border-color: rgba(251, 191, 36, .35); }
    .gallery-badge { position: absolute; top: .75rem; right: .75rem; display: inline-flex; border-radius: 999px; background: rgba(2, 6, 23, .8); border: 1px solid rgba(148, 163, 184, .18); color: #f8fafc; padding: .28rem .55rem; font-size: .8rem; font-weight: 700; }
    .gallery-title { color: #e2e8f0; font-weight: 700; }
    .caption-row { display: flex; justify-content: space-between; gap: .75rem; align-items: center; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .85rem; border-radius: .75rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .85rem; border-radius: .75rem; }
    .report-form { display: grid; gap: .9rem; }
    textarea, select { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    .lightbox-backdrop { position: fixed; inset: 0; background: rgba(2, 6, 23, .82); backdrop-filter: blur(8px); display: grid; place-items: center; padding: 1.5rem; z-index: 100; }
    .lightbox { width: min(1100px, 100%); display: grid; gap: 1rem; border: 1px solid rgba(148, 163, 184, .16); border-radius: 1.25rem; background: linear-gradient(180deg, rgba(15, 23, 42, .98), rgba(2, 6, 23, 1)); padding: 1rem; box-shadow: 0 24px 60px rgba(0, 0, 0, .45); }
    .lightbox-close { justify-self: end; }
    .lightbox-media { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 1rem; align-items: center; }
    .lightbox-nav { min-width: 96px; }
    .lightbox-figure { margin: 0; display: grid; gap: .9rem; }
    .lightbox-figure img { width: 100%; max-height: 72vh; object-fit: contain; border-radius: 1rem; background: #020617; }
    .lightbox-figure p { margin: .35rem 0 0; color: #cbd5e1; }
    @media (max-width: 900px) {
      .lightbox-media { grid-template-columns: 1fr; }
      .lightbox-nav { width: 100%; }
    }
    @media (max-width: 720px) {
      .hero { align-items: flex-start; display: grid; }
      .hero-actions { width: 100%; margin-left: 0; justify-content: flex-start; }
      .profile-action { flex: 1 1 0; width: auto; min-width: 2.75rem; max-width: 3.5rem; }
      .access-card { display: grid; }
      .compact-button { width: 100%; }
    }
  `]
})
export class ProfileDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly gallery = signal<Post[]>([]);
  protected readonly galleryItems = signal<GalleryItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingGallery = signal(false);
  protected readonly isStartingConversation = signal(false);
  protected readonly isReportComposerOpen = signal(false);
  protected readonly isSubmittingReport = signal(false);
  protected readonly isUpdatingRelationship = signal(false);
  protected readonly activeIndex = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);

  protected readonly activeItem = signal<GalleryItem | null>(null);
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  protected reportReason: ReportReason = 'harassment';
  protected reportDescription = '';
  protected readonly reportReasons = [
    { value: 'harassment', label: 'Intimidatie of grensoverschrijdend gedrag' },
    { value: 'spam_or_scam', label: 'Spam of scam' },
    { value: 'no_consent', label: 'Geen toestemming' },
    { value: 'fake_account', label: 'Fake account' },
    { value: 'prohibited', label: 'Verboden inhoud' },
    { value: 'underage', label: 'Minderjarig' },
    { value: 'copyright', label: 'Auteursrecht' },
    { value: 'other', label: 'Anders' }
  ] as const;

  public ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Profiel niet gevonden.');
      this.isLoading.set(false);
      return;
    }

    this.api.getProfile(slug).subscribe({
      next: profile => {
        this.profile.set(profile);
        this.isLoading.set(false);
        this.loadGallery(profile.user_id);
      },
      error: () => {
        this.error.set('Dit profiel kon niet geladen worden.');
        this.isLoading.set(false);
      }
    });
  }

  private loadGallery(userId: string): void {
    this.isLoadingGallery.set(true);
    this.api.getPosts({ userId }).subscribe({
      next: posts => {
        const visiblePosts = posts.filter(post => post.assets.length > 0);
        this.gallery.set(visiblePosts);
        this.galleryItems.set(
          visiblePosts.flatMap(post =>
            post.assets.map(asset => ({
              postId: post.id,
              assetId: asset.id,
              imageUrl: asset.preview_url || asset.url || '',
              locked: asset.locked,
              title: post.title,
              description: post.description,
              isPrivate: post.is_private,
              accessStatus: post.access_status
            }))
          )
        );
        this.isLoadingGallery.set(false);
      },
      error: () => {
        this.gallery.set([]);
        this.galleryItems.set([]);
        this.isLoadingGallery.set(false);
      }
    });
  }

  protected openLightbox(index: number): void {
    this.activeIndex.set(index);
    this.activeItem.set(this.galleryItems()[index] ?? null);
  }

  protected closeLightbox(): void {
    this.activeIndex.set(null);
    this.activeItem.set(null);
  }

  protected isOwnProfile(): boolean {
    return this.profile()?.user_id === this.session.user()?.id;
  }

  protected startConversation(): void {
    const profile = this.profile();
    if (!profile || this.isOwnProfile()) {
      return;
    }

    this.isStartingConversation.set(true);
    this.error.set(null);
    this.actionSuccess.set(null);
    this.api.createConversation(profile.user_id).subscribe({
      next: conversation => {
        this.isStartingConversation.set(false);
        void this.router.navigate(['/chat'], { queryParams: { conversation: conversation.id } });
      },
      error: () => {
        this.error.set('Chat starten is niet gelukt.');
        this.isStartingConversation.set(false);
      }
    });
  }

  protected toggleFavorite(): void {
    const profile = this.profile();
    if (!profile) return;
    this.isUpdatingRelationship.set(true);
    this.api.toggleFavorite(profile.user_id).subscribe({
      next: result => {
        this.profile.update(item => item ? { ...item, is_favorite: result.enabled } : item);
        this.isUpdatingRelationship.set(false);
      },
      error: () => {
        this.error.set('Favoriet bijwerken is niet gelukt.');
        this.isUpdatingRelationship.set(false);
      }
    });
  }

  protected toggleLike(): void {
    const profile = this.profile();
    if (!profile) return;
    this.isUpdatingRelationship.set(true);
    this.api.toggleLike(profile.user_id).subscribe({
      next: result => {
        this.profile.update(item => item ? { ...item, is_liked: result.enabled, is_match: result.matched } : item);
        this.actionSuccess.set(result.matched ? 'Jullie zijn een match.' : result.enabled ? 'Like opgeslagen.' : 'Like verwijderd.');
        this.isUpdatingRelationship.set(false);
      },
      error: () => {
        this.error.set('Like bijwerken is niet gelukt.');
        this.isUpdatingRelationship.set(false);
      }
    });
  }

  protected blockProfile(): void {
    const profile = this.profile();
    if (!profile) return;
    this.isUpdatingRelationship.set(true);
    this.api.blockUser(profile.user_id).subscribe({
      next: () => void this.router.navigateByUrl('/discover'),
      error: () => {
        this.error.set('Blokkeren is niet gelukt.');
        this.isUpdatingRelationship.set(false);
      }
    });
  }

  protected privateAlbums(): Post[] {
    return this.gallery().filter(post => post.is_private && post.access_status !== 'approved');
  }

  protected requestAccess(post: Post): void {
    this.api.requestPostAccess(post.id).subscribe({
      next: request => {
        this.gallery.update(items => items.map(item => item.id === post.id ? { ...item, access_status: request.status } : item));
        this.galleryItems.update(items => items.map(item => item.postId === post.id ? { ...item, accessStatus: request.status } : item));
        this.actionSuccess.set('Toegangsverzoek verstuurd.');
      },
      error: () => this.error.set('Toegang aanvragen is niet gelukt.')
    });
  }

  protected accessStatusLabel(value: Post['access_status']): string {
    if (value === 'pending') return 'verzoek in behandeling';
    if (value === 'denied') return 'eerder geweigerd';
    if (value === 'approved') return 'toegang verleend';
    return 'toegang vereist';
  }

  protected toggleReportComposer(): void {
    this.isReportComposerOpen.update(value => !value);
    this.error.set(null);
    this.actionSuccess.set(null);
  }

  protected submitProfileReport(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }

    this.isSubmittingReport.set(true);
    this.error.set(null);
    this.api.createReport({
      target_type: 'profile',
      target_id: profile.user_id,
      reason: this.reportReason,
      description: this.reportDescription.trim() || null
    }).subscribe({
      next: () => {
        this.isSubmittingReport.set(false);
        this.reportDescription = '';
        this.isReportComposerOpen.set(false);
        this.actionSuccess.set('Profiel is gemeld bij de moderation inbox.');
      },
      error: () => {
        this.error.set('Profiel melden is niet gelukt.');
        this.isSubmittingReport.set(false);
      }
    });
  }

  protected showPrevious(): void {
    const current = this.activeIndex();
    if (current === null || current <= 0) {
      return;
    }
    this.openLightbox(current - 1);
  }

  protected showNext(): void {
    const current = this.activeIndex();
    if (current === null || current >= this.galleryItems().length - 1) {
      return;
    }
    this.openLightbox(current + 1);
  }

  @HostListener('window:keydown', ['$event'])
  protected onWindowKeydown(event: KeyboardEvent): void {
    if (this.activeIndex() === null) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.showPrevious();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.showNext();
    }
  }

  protected onTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  protected onTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch || this.touchStartX === null || this.touchStartY === null) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    this.touchStartX = null;
    this.touchStartY = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX > 0) {
      this.showPrevious();
    } else {
      this.showNext();
    }
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
}
