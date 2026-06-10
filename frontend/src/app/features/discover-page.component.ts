import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Profile } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card flow">
      <div class="hero">
        <div>
          <p class="eyebrow">Ontdekken</p>
          <h1>Vind profielen die bij je passen</h1>
          <p>
            Zoek op naam, slug, locatie of profieltekst en open daarna het volledige profiel.
          </p>
        </div>
        <div class="hero-actions">
          <a routerLink="/profile" class="secondary-link">Mijn profiel aanpassen</a>
        </div>
      </div>

      @if (!session.isLoggedIn()) {
        <p>Log in om het overzicht te bekijken.</p>
        <a routerLink="/login">Naar login</a>
      } @else {
        <form class="filters" (ngSubmit)="load()">
          <label>
            Zoeken
            <input
              name="query"
              [(ngModel)]="query"
              maxlength="80"
              placeholder="Naam, slug, bio of interesse"
            />
          </label>

          <label>
            Locatie
            <input
              name="location"
              [(ngModel)]="location"
              maxlength="120"
              placeholder="Amsterdam, Antwerpen, online..."
            />
          </label>

          <label>
            Leeftijd vanaf
            <input name="ageMin" [(ngModel)]="ageMin" type="number" min="18" max="99" placeholder="18" />
          </label>

          <label>
            Leeftijd tot
            <input name="ageMax" [(ngModel)]="ageMax" type="number" min="18" max="99" placeholder="99" />
          </label>

          <label>
            Gender
            <input name="gender" [(ngModel)]="gender" maxlength="80" placeholder="Bijv. vrouw" />
          </label>

          <div class="quick-filters">
            <label><input type="checkbox" name="onlineOnly" [(ngModel)]="onlineOnly" /> Alleen online</label>
            <label><input type="checkbox" name="withPhotos" [(ngModel)]="withPhotos" /> Met foto's</label>
            <label><input type="checkbox" name="favoritesOnly" [(ngModel)]="favoritesOnly" /> Favorieten</label>
            <label><input type="checkbox" name="matchesOnly" [(ngModel)]="matchesOnly" /> Matches</label>
          </div>

          <div class="filter-actions">
            <button type="submit" [disabled]="isLoading()">{{ isLoading() ? 'Zoeken...' : 'Zoeken' }}</button>
            <button type="button" class="secondary" (click)="clearFilters()" [disabled]="isLoading()">Reset</button>
          </div>
        </form>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        @if (isLoading()) {
          <p>Profielen laden...</p>
        } @else if (profiles().length === 0) {
          <div class="empty">
            <h2>Geen matches gevonden</h2>
            <p>Pas je zoekterm aan of vul eerst meer profielinformatie in voor testaccounts.</p>
            <a routerLink="/profile">Profiel aanvullen</a>
          </div>
        } @else {
          <p class="results">{{ profiles().length }} profiel(en) gevonden.</p>
          <div class="grid">
            @for (profile of profiles(); track profile.id) {
              <a class="tile" [routerLink]="['/discover', profile.slug]">
                <div class="tile-head">
                  <div class="avatar">{{ initials(profile.display_name) }}</div>
                  <div>
                    <h2>{{ profile.display_name }}</h2>
                    <p class="muted">/{{ profile.slug }}</p>
                  </div>
                </div>

                <div class="meta-row">
                  @if (profile.age_label) {
                    <span class="pill">{{ profile.age_label }}</span>
                  }
                  @for (interest of profile.interests; track interest) {
                    <span class="pill interest">{{ interest }}</span>
                  }
                  @if (profile.is_match) {
                    <span class="pill match">Match</span>
                  } @else if (profile.is_favorite) {
                    <span class="pill favorite">Favoriet</span>
                  }
                  @if (profile.gender) {
                    <span class="pill">{{ profile.gender }}</span>
                  }
                  @if (profile.location_label) {
                    <span class="pill">{{ profile.location_label }}</span>
                  }
                </div>

                <p class="bio">{{ profile.bio || 'Nog geen beschrijving toegevoegd.' }}</p>

                <div class="tile-footer">
                  <span>
                    @if (profile.last_active_at) {
                      Actief: {{ relativeTime(profile.last_active_at) }}
                    } @else {
                      Nieuw profiel
                    }
                  </span>
                  <span class="link-label">Bekijk profiel</span>
                </div>
              </a>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1.25rem; }
    .hero { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(30, 41, 59, .92) 55%, rgba(9, 9, 11, .94)); border: 1px solid rgba(148, 163, 184, .14); color: #f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }
    .hero-actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .secondary-link { display: inline-flex; align-items: center; padding: .78rem 1rem; border-radius: 999px; border: 1px solid rgba(148, 163, 184, .2); background: rgba(15, 23, 42, .85); color: #e2e8f0; text-decoration: none; font-weight: 700; }
    .secondary-link:hover { border-color: rgba(251, 191, 36, .45); color: #f8fafc; }
    .eyebrow { margin: 0 0 .25rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .filters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1rem; align-items: end; }
    label { display: grid; gap: .35rem; color: #cbd5e1; font-weight: 600; }
    input { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    .filter-actions { display: flex; gap: .75rem; flex-wrap: wrap; }
    .quick-filters { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: .65rem; }
    .quick-filters label { display: flex; align-items: center; gap: .4rem; padding: .55rem .7rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: 999px; }
    .quick-filters input { width: 1rem; height: 1rem; }
    .results { color: #94a3b8; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
    .tile { display: grid; gap: 1rem; padding: 1.1rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; background: linear-gradient(180deg, rgba(15, 23, 42, .95), rgba(2, 6, 23, .98)); color: #f8fafc; text-decoration: none; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; box-shadow: 0 16px 36px rgba(0, 0, 0, .24); }
    .tile:hover { transform: translateY(-2px); box-shadow: 0 22px 44px rgba(0, 0, 0, .32); border-color: rgba(251, 191, 36, .32); }
    .tile-head { display: flex; gap: .9rem; align-items: center; }
    .tile-head h2 { margin: 0; }
    .avatar { display: grid; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899 50%, #38bdf8); color: white; font-weight: 900; flex: 0 0 auto; box-shadow: 0 10px 24px rgba(236, 72, 153, .18); }
    .muted { color: #94a3b8; margin: .15rem 0 0; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .3rem .7rem; font-size: .92rem; font-weight: 700; }
    .pill.match { color: #f9a8d4; border-color: rgba(244, 114, 182, .35); }
    .pill.favorite { color: #fde68a; }
    .pill.interest { font-weight: 500; }
    .bio { margin: 0; color: #cbd5e1; line-height: 1.5; }
    .tile-footer { display: flex; justify-content: space-between; gap: .75rem; align-items: center; color: #94a3b8; font-size: .95rem; }
    .link-label { color: #fbbf24; font-weight: 700; }
    .empty { border: 1px dashed rgba(148, 163, 184, .22); border-radius: 1rem; padding: 1.25rem; background: rgba(15, 23, 42, .6); }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .85rem; border-radius: .75rem; }
    @media (max-width: 760px) {
      .hero, .tile-footer { display: grid; }
      .filters { grid-template-columns: 1fr; }
    }
  `]
})
export class DiscoverPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly profiles = signal<Profile[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected query = '';
  protected location = '';
  protected ageMin: number | null = null;
  protected ageMax: number | null = null;
  protected gender = '';
  protected onlineOnly = false;
  protected withPhotos = false;
  protected favoritesOnly = false;
  protected matchesOnly = false;

  public ngOnInit(): void {
    if (this.session.isLoggedIn()) {
      this.load();
    }
  }

  protected load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.api.getProfiles({
      q: this.query.trim() || undefined,
      location: this.location.trim() || undefined,
      ageMin: this.ageMin || undefined,
      ageMax: this.ageMax || undefined,
      gender: this.gender.trim() || undefined,
      onlineOnly: this.onlineOnly,
      withPhotos: this.withPhotos,
      favoritesOnly: this.favoritesOnly,
      matchesOnly: this.matchesOnly,
      limit: 50
    }).subscribe({
      next: profiles => {
        this.profiles.set(profiles);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Profielen laden is niet gelukt.');
        this.isLoading.set(false);
      }
    });
  }

  protected clearFilters(): void {
    this.query = '';
    this.location = '';
    this.ageMin = null;
    this.ageMax = null;
    this.gender = '';
    this.onlineOnly = false;
    this.withPhotos = false;
    this.favoritesOnly = false;
    this.matchesOnly = false;
    this.load();
  }

  protected initials(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  }

  protected relativeTime(value: string): string {
    const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 3600) {
      const minutes = Math.max(1, Math.round(seconds / 60));
      return `${minutes} min geleden`;
    }
    if (seconds < 86400) {
      return `${Math.round(seconds / 3600)} uur geleden`;
    }
    return `${Math.round(seconds / 86400)} dag(en) geleden`;
  }
}
