import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, Profile } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="card flow">
      <div class="title-row">
        <div>
          <p class="eyebrow">Overzicht</p>
          <h1>Profielen ontdekken</h1>
          <p>Bekijk actieve profielen en gebruik dit scherm als startpunt van de MVP-flow.</p>
        </div>
        <button type="button" class="secondary" (click)="load()" [disabled]="isLoading()">Verversen</button>
      </div>

      @if (!session.isLoggedIn()) {
        <p>Log in om het overzicht te bekijken.</p>
        <a routerLink="/login">Naar login</a>
      } @else {
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        @if (isLoading()) {
          <p>Profielen laden...</p>
        } @else if (profiles().length === 0) {
          <div class="empty">
            <h2>Nog geen profielen</h2>
            <p>Maak eerst je eigen profiel aan of registreer een tweede testaccount.</p>
            <a routerLink="/profile">Profiel aanmaken</a>
          </div>
        } @else {
          <div class="grid">
            @for (profile of profiles(); track profile.id) {
              <article class="tile">
                <div class="avatar">{{ initials(profile.display_name) }}</div>
                <div>
                  <h2>{{ profile.display_name }}</h2>
                  <p class="muted">/{{ profile.slug }}</p>
                  @if (profile.location_label) { <p>{{ profile.location_label }}</p> }
                  @if (profile.bio) { <p>{{ profile.bio }}</p> }
                </div>
              </article>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; }
    .title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .eyebrow { color: #f472b6; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .tile { display: flex; gap: 1rem; padding: 1rem; border: 1px solid rgba(255,255,255,.12); border-radius: 1rem; background: rgba(255,255,255,.04); }
    .avatar { display: grid; place-items: center; width: 3rem; height: 3rem; border-radius: 999px; background: linear-gradient(135deg, #f472b6, #8b5cf6); color: white; font-weight: 900; flex: 0 0 auto; }
    .muted { color: #9ca3af; }
    .empty { border: 1px dashed rgba(255,255,255,.18); border-radius: 1rem; padding: 1.25rem; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
  `]
})
export class DiscoverPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly profiles = signal<Profile[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  public ngOnInit(): void {
    if (this.session.isLoggedIn()) {
      this.load();
    }
  }

  protected load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.api.getProfiles().subscribe({
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

  protected initials(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  }
}
