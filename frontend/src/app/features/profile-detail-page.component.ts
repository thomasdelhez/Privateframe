import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Profile } from '../core/api.service';

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
            <h2>Over dit profiel</h2>
            <p>{{ item.bio || 'Nog geen beschrijving ingevuld.' }}</p>
          </article>

          <article class="panel">
            <h2>Activiteit</h2>
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
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1.25rem; }
    .back-link { color: #1d4ed8; text-decoration: none; font-weight: 700; }
    .hero { display: flex; gap: 1rem; align-items: center; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, #fff7ed, #dbeafe); color: #172554; }
    .avatar { display: grid; place-items: center; width: 4.75rem; height: 4.75rem; border-radius: 999px; background: linear-gradient(135deg, #ea580c, #2563eb); color: white; font-size: 1.35rem; font-weight: 900; flex: 0 0 auto; }
    .hero-copy { display: grid; gap: .35rem; }
    .eyebrow { margin: 0; color: #9a3412; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .muted { color: #475569; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .pill { border-radius: 999px; background: rgba(255,255,255,.8); padding: .35rem .7rem; font-size: .95rem; font-weight: 700; }
    .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .panel { border: 1px solid #dbeafe; border-radius: 1.25rem; padding: 1.2rem; background: #f8fafc; color: #0f172a; }
    .panel h2 { margin-top: 0; }
    .error { color: #991b1b; background: #fee2e2; padding: .85rem; border-radius: .75rem; }
    @media (max-width: 720px) {
      .hero { align-items: flex-start; }
    }
  `]
})
export class ProfileDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

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
      },
      error: () => {
        this.error.set('Dit profiel kon niet geladen worden.');
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

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }
}
