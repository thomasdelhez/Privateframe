import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiService, Post, Profile, ProfileVisitSummary } from '../core/api.service';
import { ChatPresenceService } from '../core/chat-presence.service';
import { SessionService } from '../core/session.service';

interface PhotoCard {
  id: string;
  imageUrl: string;
  title: string;
  profile: Profile;
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (!session.isLoggedIn()) {
      <section class="visitor-hero">
        <div class="visitor-copy">
          <p class="eyebrow">PrivateFrame</p>
          <h1>Ontdek mensen, foto's en gesprekken in een besloten community.</h1>
          <p class="lead">
            Maak een profiel, deel wat bij jou past en kom direct in contact met andere leden.
          </p>
          <div class="actions-row">
            <a routerLink="/login">Account aanmaken</a>
            <a routerLink="/login" class="secondary-link">Inloggen</a>
          </div>
        </div>
        <div class="visitor-preview" aria-hidden="true">
          <div class="preview-card preview-one"><span>Nieuwe profielen</span></div>
          <div class="preview-card preview-two"><span>Foto's ontdekken</span></div>
          <div class="preview-card preview-three"><span>Realtime chat</span></div>
        </div>
      </section>

      <section class="visitor-features">
        <article class="card">
          <strong>Ontdek op jouw manier</strong>
          <p>Zoek op naam, locatie en profielinformatie.</p>
        </article>
        <article class="card">
          <strong>Foto's centraal</strong>
          <p>Bekijk nieuwe uploads direct vanuit de community.</p>
        </article>
        <article class="card">
          <strong>Veilig contact</strong>
          <p>Chat, blokkeer en meld met duidelijke moderatie.</p>
        </article>
      </section>
    } @else if (!session.isEmailVerified() || !session.user()?.age_confirmed) {
      <section class="card onboarding-card">
        <p class="eyebrow">Bijna klaar</p>
        <h1>Rond eerst je toegang af</h1>
        <p class="muted">Na je bevestiging verschijnen hier profielen, foto's en activiteit van andere leden.</p>
        <div class="actions-row">
          @if (!session.isEmailVerified()) {
            <a routerLink="/verify-email">E-mail bevestigen</a>
          } @else {
            <a routerLink="/age">Toegang bevestigen</a>
          }
          <a routerLink="/profile" class="secondary-link">Mijn profiel</a>
        </div>
      </section>
    } @else {
      <section class="member-home">
        <header class="member-hero">
          <div>
            <p class="eyebrow">{{ greeting() }}</p>
            <h1>
              @if (myProfile()) {
                Welkom terug, {{ myProfile()?.display_name }}
              } @else {
                Welkom terug
              }
            </h1>
            <p class="muted">Bekijk wie er actief is en ontdek wat er nieuw is in de community.</p>
          </div>
          <div class="hero-actions actions-row">
            <a routerLink="/discover">Alles ontdekken</a>
            <a routerLink="/profile" class="secondary-link">Mijn profiel</a>
          </div>
        </header>

        <section class="status-grid">
          @if (session.isPremium()) {
            <a routerLink="/chat" class="status-card">
              <span class="status-value">{{ chatPresence.unreadCount() }}</span>
              <span>Ongelezen berichten</span>
            </a>
          } @else {
            <a routerLink="/plan" class="status-card">
              <span class="status-value">Chat</span>
              <span>Beschikbaar met uitgebreid account</span>
            </a>
          }
          <a routerLink="/profile" class="status-card">
            <span class="status-value">{{ activity()?.count || 0 }}</span>
            <span>Recente profielbezoeken</span>
          </a>
          <a routerLink="/profile" class="status-card">
            <span class="status-value">{{ profileCompletion() }}%</span>
            <span>Profiel compleet</span>
          </a>
        </section>

        @if (isLoading()) {
          <section class="card loading-card">
            <span class="loading-dot"></span>
            <p>Je persoonlijke homepage wordt geladen...</p>
          </section>
        } @else {
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow">{{ onlineProfiles().length ? 'Nu beschikbaar' : 'Recent actief' }}</p>
                <h2>{{ onlineProfiles().length ? 'Leden die nu online zijn' : 'Leden die recent actief waren' }}</h2>
              </div>
              <a routerLink="/discover" class="text-link">Bekijk iedereen</a>
            </div>

            @if (activeProfiles().length === 0) {
              <div class="empty-card">Zodra leden actief worden, verschijnen ze hier.</div>
            } @else {
              <div class="active-strip">
                @for (profile of activeProfiles(); track profile.id) {
                  <a class="active-profile" [routerLink]="['/discover', profile.slug]">
                    <div class="active-avatar">
                      @if (profilePhoto(profile); as photo) {
                        <img [src]="photo" alt="Foto van {{ profile.display_name }}" />
                      } @else {
                        <span>{{ initials(profile.display_name) }}</span>
                      }
                      <i [class.online]="isOnline(profile)"></i>
                    </div>
                    <strong>{{ profile.display_name }}</strong>
                    <span>{{ activityLabel(profile) }}</span>
                  </a>
                }
              </div>
            }
          </section>

          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow">Voor jou</p>
                <h2>Ontdek profielen</h2>
              </div>
              <a routerLink="/discover" class="text-link">Meer profielen</a>
            </div>

            @if (discoverProfiles().length === 0) {
              <div class="empty-card">Er zijn nog geen andere profielen om te tonen.</div>
            } @else {
              <div class="profile-grid">
                @for (profile of discoverProfiles(); track profile.id) {
                  <a class="profile-card" [routerLink]="['/discover', profile.slug]">
                    <div class="profile-media">
                      @if (profilePhoto(profile); as photo) {
                        <img [src]="photo" alt="Foto van {{ profile.display_name }}" />
                      } @else {
                        <span class="profile-placeholder">{{ initials(profile.display_name) }}</span>
                      }
                      @if (isOnline(profile)) {
                        <span class="online-badge">Online</span>
                      }
                    </div>
                    <div class="profile-copy">
                      <div class="profile-title">
                        <h3>{{ profile.display_name }}</h3>
                        @if (profile.age_label) {
                          <span>{{ profile.age_label }}</span>
                        }
                      </div>
                      <p>{{ profile.location_label || profile.gender || 'Nieuw profiel' }}</p>
                      <span class="view-label">Bekijk profiel</span>
                    </div>
                  </a>
                }
              </div>
            }
          </section>

          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow">Net gedeeld</p>
                <h2>Nieuwe foto's</h2>
              </div>
            </div>

            @if (newPhotos().length === 0) {
              <div class="empty-card">Nieuwe foto's van andere leden verschijnen hier.</div>
            } @else {
              <div class="photo-grid">
                @for (photo of newPhotos(); track photo.id) {
                  <a class="photo-card" [routerLink]="['/discover', photo.profile.slug]">
                    <img [src]="photo.imageUrl" alt="{{ photo.title }} van {{ photo.profile.display_name }}" />
                    <div class="photo-overlay">
                      <strong>{{ photo.profile.display_name }}</strong>
                      <span>{{ photo.title }}</span>
                    </div>
                  </a>
                }
              </div>
            }
          </section>

          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow">Nieuw hier</p>
                <h2>Nieuwe leden</h2>
              </div>
            </div>
            <div class="new-member-grid">
              @for (profile of newProfiles(); track profile.id) {
                <a class="new-member-card" [routerLink]="['/discover', profile.slug]">
                  <div class="small-avatar">
                    @if (profilePhoto(profile); as photo) {
                      <img [src]="photo" alt="Foto van {{ profile.display_name }}" />
                    } @else {
                      {{ initials(profile.display_name) }}
                    }
                  </div>
                  <div>
                    <strong>{{ profile.display_name }}</strong>
                    <p>{{ profile.location_label || 'Bekijk het profiel' }}</p>
                  </div>
                </a>
              }
            </div>
          </section>
        }
      </section>
    }
  `,
  styles: [`
    .visitor-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 1.25rem; min-height: 520px; }
    .visitor-copy, .visitor-preview { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.6rem; background: linear-gradient(140deg, rgba(15, 23, 42, .98), rgba(9, 9, 11, .98)); box-shadow: 0 24px 60px rgba(0, 0, 0, .28); }
    .visitor-copy { display: grid; align-content: center; gap: 1rem; padding: clamp(1.5rem, 5vw, 3.5rem); }
    .visitor-copy h1 { max-width: 760px; }
    .lead { max-width: 650px; margin: 0; color: #cbd5e1; font-size: 1.08rem; line-height: 1.7; }
    .visitor-preview { position: relative; min-height: 430px; overflow: hidden; background: radial-gradient(circle at 70% 15%, rgba(236, 72, 153, .24), transparent 34%), radial-gradient(circle at 20% 75%, rgba(245, 158, 11, .18), transparent 32%), #070b14; }
    .preview-card { position: absolute; display: flex; align-items: flex-end; width: 52%; aspect-ratio: 4 / 5; padding: 1rem; border-radius: 1.4rem; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 22px 50px rgba(0,0,0,.35); color: white; font-weight: 800; }
    .preview-one { top: 8%; left: 8%; transform: rotate(-7deg); background: linear-gradient(150deg, #334155, #111827 58%, #831843); }
    .preview-two { top: 20%; right: 7%; transform: rotate(7deg); background: linear-gradient(150deg, #78350f, #1f2937 55%, #172554); }
    .preview-three { left: 24%; bottom: -28%; background: linear-gradient(150deg, #4c1d95, #111827 60%, #0f766e); }
    .visitor-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-top: 1rem; }
    .visitor-features article { display: grid; gap: .4rem; }
    .visitor-features p { margin: 0; color: #94a3b8; }
    .onboarding-card { display: grid; gap: 1rem; max-width: 720px; margin: 2rem auto; }
    .member-home { display: grid; gap: 1.5rem; }
    .member-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.5rem; border-radius: 1.5rem; border: 1px solid rgba(148, 163, 184, .14); background: radial-gradient(circle at 90% 10%, rgba(236, 72, 153, .16), transparent 28%), linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(9, 9, 11, .98)); }
    .member-hero h1, .member-hero p { margin-bottom: .35rem; }
    .hero-actions { flex: 0 0 auto; }
    .status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .status-card { display: grid; gap: .3rem; min-height: 110px; align-content: center; padding: 1rem 1.15rem; border-radius: 1.15rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .72); color: #cbd5e1; text-decoration: none; }
    .status-card:hover { border-color: rgba(244, 114, 182, .3); transform: translateY(-1px); }
    .status-value { color: #f8fafc; font-size: 1.7rem; font-weight: 900; }
    .loading-card { display: flex; align-items: center; justify-content: center; gap: .75rem; min-height: 180px; }
    .loading-dot { width: .8rem; height: .8rem; border-radius: 999px; background: #f472b6; box-shadow: 0 0 0 .45rem rgba(244, 114, 182, .12); }
    .home-section { display: grid; gap: 1rem; }
    .section-head { display: flex; justify-content: space-between; align-items: end; gap: 1rem; }
    .section-head h2, .section-head p { margin-bottom: 0; }
    .text-link { color: #f9a8d4; font-weight: 800; text-decoration: none; white-space: nowrap; }
    .active-strip { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(112px, 132px); gap: .8rem; overflow-x: auto; padding: .2rem .1rem .75rem; scrollbar-width: thin; }
    .active-profile { display: grid; justify-items: center; gap: .4rem; padding: .8rem .55rem; border-radius: 1.1rem; background: rgba(15, 23, 42, .66); border: 1px solid rgba(148, 163, 184, .12); color: #f8fafc; text-align: center; text-decoration: none; }
    .active-profile > span { color: #94a3b8; font-size: .78rem; }
    .active-avatar { position: relative; display: grid; place-items: center; width: 4.4rem; height: 4.4rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899 52%, #38bdf8); font-weight: 900; overflow: visible; }
    .active-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
    .active-avatar i { position: absolute; right: .1rem; bottom: .15rem; width: .9rem; height: .9rem; border: 3px solid #0b101a; border-radius: 999px; background: #64748b; }
    .active-avatar i.online { background: #22c55e; }
    .profile-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .profile-card { overflow: hidden; border-radius: 1.25rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .74); color: #f8fafc; text-decoration: none; box-shadow: 0 16px 38px rgba(0,0,0,.2); }
    .profile-card:hover { transform: translateY(-2px); border-color: rgba(244, 114, 182, .3); }
    .profile-media { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 5; overflow: hidden; background: linear-gradient(140deg, #1e293b, #111827 55%, #4c1d95); }
    .profile-media img { width: 100%; height: 100%; object-fit: cover; }
    .profile-placeholder { font-size: 2.2rem; font-weight: 900; }
    .online-badge { position: absolute; left: .75rem; bottom: .75rem; padding: .3rem .58rem; border-radius: 999px; background: rgba(3, 24, 15, .86); border: 1px solid rgba(34, 197, 94, .4); color: #86efac; font-size: .78rem; font-weight: 800; }
    .profile-copy { display: grid; gap: .35rem; padding: .9rem; }
    .profile-title { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; }
    .profile-title h3 { margin: 0; }
    .profile-title span, .profile-copy p { color: #94a3b8; }
    .profile-copy p { min-height: 1.4em; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .view-label { color: #f9a8d4; font-size: .88rem; font-weight: 800; }
    .photo-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .8rem; }
    .photo-card { position: relative; overflow: hidden; aspect-ratio: 4 / 5; border-radius: 1.15rem; border: 1px solid rgba(148, 163, 184, .14); background: #020617; }
    .photo-card img { width: 100%; height: 100%; object-fit: cover; transition: transform .2s ease; }
    .photo-card:hover img { transform: scale(1.025); }
    .photo-overlay { position: absolute; inset: auto 0 0; display: grid; gap: .15rem; padding: 2.5rem .85rem .85rem; background: linear-gradient(transparent, rgba(2, 6, 23, .95)); color: white; }
    .photo-overlay span { color: #cbd5e1; font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .new-member-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
    .new-member-card { display: flex; align-items: center; gap: .8rem; padding: .85rem; border-radius: 1rem; background: rgba(15, 23, 42, .65); border: 1px solid rgba(148, 163, 184, .12); color: #f8fafc; text-decoration: none; }
    .small-avatar { display: grid; place-items: center; flex: 0 0 auto; width: 3rem; height: 3rem; overflow: hidden; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899); font-weight: 900; }
    .small-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .new-member-card p { margin: .15rem 0 0; color: #94a3b8; font-size: .88rem; }
    .empty-card { padding: 1.15rem; border-radius: 1rem; border: 1px dashed rgba(148, 163, 184, .2); background: rgba(15, 23, 42, .42); color: #94a3b8; }
    @media (max-width: 980px) {
      .visitor-hero { grid-template-columns: 1fr; min-height: auto; }
      .visitor-preview { min-height: 380px; }
      .profile-grid, .photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .new-member-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .visitor-features, .status-grid { grid-template-columns: 1fr; }
      .member-hero, .section-head { display: grid; }
      .status-card { min-height: 88px; }
      .hero-actions { width: 100%; }
    }
    @media (max-width: 480px) {
      .visitor-copy, .visitor-preview { border-radius: 1.2rem; }
      .visitor-preview { min-height: 320px; }
      .profile-grid, .photo-grid, .new-member-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; }
      .profile-copy { padding: .7rem; }
      .profile-title { display: grid; gap: .05rem; }
      .profile-title h3 { font-size: 1rem; }
      .new-member-card { display: grid; justify-items: center; text-align: center; }
    }
  `]
})
export class HomePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);
  protected readonly chatPresence = inject(ChatPresenceService);

  protected readonly profiles = signal<Profile[]>([]);
  protected readonly posts = signal<Post[]>([]);
  protected readonly myProfile = signal<Profile | null>(null);
  protected readonly activity = signal<ProfileVisitSummary | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly profileByUserId = computed(() =>
    new Map(this.profiles().map(profile => [profile.user_id, profile]))
  );

  private readonly photoByUserId = computed(() => {
    const photos = new Map<string, string>();
    for (const post of this.posts()) {
      const imageUrl = post.assets[0]?.preview_url || post.assets[0]?.url;
      if (imageUrl && !photos.has(post.user_id)) {
        photos.set(post.user_id, imageUrl);
      }
    }
    return photos;
  });

  protected readonly onlineProfiles = computed(() =>
    this.profiles().filter(profile => this.isOnline(profile)).slice(0, 12)
  );

  protected readonly activeProfiles = computed(() => {
    const online = this.onlineProfiles();
    return online.length > 0
      ? online
      : this.profiles().filter(profile => profile.last_active_at).slice(0, 12);
  });

  protected readonly discoverProfiles = computed(() => this.profiles().slice(0, 8));

  protected readonly newProfiles = computed(() =>
    [...this.profiles()]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
  );

  protected readonly newPhotos = computed<PhotoCard[]>(() => {
    const profiles = this.profileByUserId();
    return this.posts()
      .flatMap(post => {
        const profile = profiles.get(post.user_id);
        if (!profile) {
          return [];
        }
        return post.assets.map(asset => ({
          id: asset.id,
          imageUrl: asset.preview_url || asset.url || '',
          title: post.title,
          profile
        }));
      })
      .filter(photo => !!photo.imageUrl)
      .slice(0, 8);
  });

  public ngOnInit(): void {
    if (!this.session.isLoggedIn() || !this.session.isEmailVerified() || !this.session.user()?.age_confirmed) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    forkJoin({
      profiles: this.api.getProfiles({ limit: 50 }).pipe(catchError(() => of([] as Profile[]))),
      posts: this.api.getPosts().pipe(catchError(() => of([] as Post[]))),
      myProfile: this.api.getMyProfile().pipe(catchError(() => of(null))),
      activity: this.api.getMyProfileActivity().pipe(catchError(() => of({ count: 0, visits: [] })))
    }).subscribe({
      next: result => {
        this.profiles.set(result.profiles);
        this.posts.set(result.posts);
        this.myProfile.set(result.myProfile);
        this.activity.set(result.activity);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('De ledenhomepage kon niet volledig worden geladen.');
        this.isLoading.set(false);
      }
    });
  }

  protected profilePhoto(profile: Profile): string | null {
    return this.photoByUserId().get(profile.user_id) || null;
  }

  protected isOnline(profile: Profile): boolean {
    if (!profile.last_active_at) {
      return false;
    }
    return Date.now() - new Date(profile.last_active_at).getTime() <= 5 * 60 * 1000;
  }

  protected activityLabel(profile: Profile): string {
    if (this.isOnline(profile)) {
      return 'Nu online';
    }
    if (!profile.last_active_at) {
      return 'Nieuw lid';
    }

    const minutes = Math.max(1, Math.round((Date.now() - new Date(profile.last_active_at).getTime()) / 60000));
    if (minutes < 60) {
      return `${minutes} min geleden`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return `${hours} uur geleden`;
    }
    return `${Math.round(hours / 24)} dag(en) geleden`;
  }

  protected profileCompletion(): number {
    const profile = this.myProfile();
    if (!profile) {
      return 15;
    }
    const fields = [
      profile.display_name,
      profile.bio,
      profile.location_label,
      profile.gender,
      profile.age_label,
      this.posts().some(post => post.user_id === profile.user_id && post.assets.length > 0)
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }

  protected greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Goedemorgen';
    }
    if (hour < 18) {
      return 'Goedemiddag';
    }
    return 'Goedenavond';
  }

  protected initials(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  }
}
