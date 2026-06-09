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
          <button type="button" class="secondary" (click)="load()" [disabled]="isLoading()">Verversen</button>
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
    .hero { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, #eff6ff, #fef3c7); color: #172554; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .eyebrow { margin: 0 0 .25rem; color: #c2410c; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .filters { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto; gap: 1rem; align-items: end; }
    label { display: grid; gap: .35rem; color: #334155; font-weight: 600; }
    input { width: 100%; border: 1px solid #cbd5e1; border-radius: .85rem; background: white; color: #0f172a; padding: .85rem .95rem; }
    .filter-actions { display: flex; gap: .75rem; flex-wrap: wrap; }
    .results { color: #475569; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
    .tile { display: grid; gap: 1rem; padding: 1.1rem; border: 1px solid #dbeafe; border-radius: 1.25rem; background: linear-gradient(180deg, #ffffff, #f8fafc); color: #0f172a; text-decoration: none; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
    .tile:hover { transform: translateY(-2px); box-shadow: 0 18px 38px rgba(37, 99, 235, .12); border-color: #93c5fd; }
    .tile-head { display: flex; gap: .9rem; align-items: center; }
    .tile-head h2 { margin: 0; }
    .avatar { display: grid; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 999px; background: linear-gradient(135deg, #ea580c, #2563eb); color: white; font-weight: 900; flex: 0 0 auto; }
    .muted { color: #64748b; margin: .15rem 0 0; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .pill { border-radius: 999px; background: #e0f2fe; color: #0f172a; padding: .3rem .7rem; font-size: .92rem; font-weight: 700; }
    .bio { margin: 0; color: #334155; line-height: 1.5; }
    .tile-footer { display: flex; justify-content: space-between; gap: .75rem; align-items: center; color: #475569; font-size: .95rem; }
    .link-label { color: #1d4ed8; font-weight: 700; }
    .empty { border: 1px dashed #cbd5e1; border-radius: 1rem; padding: 1.25rem; background: #f8fafc; }
    .error { color: #991b1b; background: #fee2e2; padding: .85rem; border-radius: .75rem; }
    @media (max-width: 760px) {
      .hero { display: grid; }
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
