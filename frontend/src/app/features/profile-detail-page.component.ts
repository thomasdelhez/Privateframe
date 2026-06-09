import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Post, Profile } from '../core/api.service';

interface GalleryItem {
  assetId: string;
  imageUrl: string;
  locked: boolean;
  title: string;
  description: string | null;
}

@Component({
  standalone: true,
  imports: [RouterLink],
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
        </header>

        <div class="details-grid">
          <article class="panel">
            <h2>Over {{ item.display_name }}</h2>
            <p>{{ item.bio || 'Nog geen beschrijving ingevuld.' }}</p>
          </article>

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

          <div class="lightbox-media">
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
                  <p class="muted">Deze gebruiker heeft meer zichtbaar voor premiumaccounts.</p>
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
    .eyebrow { margin: 0; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .muted { color: #94a3b8; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .35rem .7rem; font-size: .95rem; font-weight: 700; }
    .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.2rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; }
    .panel h2 { margin-top: 0; }
    .gallery-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .gallery-item { position: relative; display: grid; gap: .65rem; margin: 0; padding: 0; border: 0; background: transparent; text-align: left; }
    .gallery-item img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: .9rem; border: 1px solid rgba(148, 163, 184, .16); background: #020617; transition: transform .18s ease, border-color .18s ease; }
    .gallery-item:hover img { transform: translateY(-2px); border-color: rgba(251, 191, 36, .35); }
    .gallery-badge { position: absolute; top: .75rem; right: .75rem; display: inline-flex; border-radius: 999px; background: rgba(2, 6, 23, .8); border: 1px solid rgba(148, 163, 184, .18); color: #f8fafc; padding: .28rem .55rem; font-size: .8rem; font-weight: 700; }
    .gallery-title { color: #e2e8f0; font-weight: 700; }
    .caption-row { display: flex; justify-content: space-between; gap: .75rem; align-items: center; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .85rem; border-radius: .75rem; }
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
      .hero { align-items: flex-start; }
    }
  `]
})
export class ProfileDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly gallery = signal<Post[]>([]);
  protected readonly galleryItems = signal<GalleryItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingGallery = signal(false);
  protected readonly activeIndex = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly activeItem = signal<GalleryItem | null>(null);

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
              assetId: asset.id,
              imageUrl: asset.preview_url || asset.url || '',
              locked: asset.locked,
              title: post.title,
              description: post.description
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
