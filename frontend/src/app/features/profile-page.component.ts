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
      <div class="title-row">
        <div>
          <p class="eyebrow">Profiel</p>
          <h1>Jouw profiel</h1>
          <p>Maak een basisprofiel aan zodat je zichtbaar wordt in het overzicht.</p>
        </div>
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

        <form class="form" (ngSubmit)="save()">
          <label>
            Weergavenaam
            <input name="displayName" [(ngModel)]="displayName" maxlength="80" required />
          </label>

          <label>
            Locatie label
            <input name="locationLabel" [(ngModel)]="locationLabel" maxlength="120" />
          </label>

          <label>
            Korte beschrijving
            <textarea name="bio" [(ngModel)]="bio" maxlength="800" rows="5"></textarea>
          </label>

          <button type="submit" [disabled]="isSaving() || !displayName.trim()">
            {{ isSaving() ? 'Opslaan...' : 'Profiel opslaan' }}
          </button>
        </form>

        @if (profile(); as item) {
          <div class="preview">
            <h2>Preview</h2>
            <h3>{{ item.display_name }}</h3>
            <p class="muted">/{{ item.slug }}</p>
            @if (item.location_label) { <p>{{ item.location_label }}</p> }
            @if (item.bio) { <p>{{ item.bio }}</p> }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; max-width: 760px; }
    .title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .eyebrow { color: #f472b6; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .form { display: grid; gap: 1rem; }
    label { display: grid; gap: .35rem; color: #d1d5db; }
    input, textarea { width: 100%; border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; background: rgba(15,23,42,.9); color: #f9fafb; padding: .8rem; }
    textarea { resize: vertical; }
    .preview { border: 1px solid rgba(255,255,255,.12); border-radius: 1rem; padding: 1rem; background: rgba(255,255,255,.04); }
    .muted { color: #9ca3af; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
  `]
})
export class ProfilePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected displayName = '';
  protected locationLabel = '';
  protected bio = '';

  public ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      return;
    }

    this.api.getMyProfile().subscribe({
      next: profile => this.applyProfile(profile),
      error: () => {
        const user = this.session.user();
        this.displayName = user?.email.split('@')[0] ?? '';
      }
    });
  }

  protected save(): void {
    this.isSaving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.saveMyProfile({
      display_name: this.displayName.trim(),
      location_label: this.locationLabel.trim() || null,
      bio: this.bio.trim() || null
    }).subscribe({
      next: profile => {
        this.applyProfile(profile);
        this.success.set('Profiel opgeslagen.');
        this.isSaving.set(false);
      },
      error: () => {
        this.error.set('Opslaan is niet gelukt. Controleer je invoer en probeer opnieuw.');
        this.isSaving.set(false);
      }
    });
  }

  private applyProfile(profile: Profile): void {
    this.profile.set(profile);
    this.displayName = profile.display_name;
    this.locationLabel = profile.location_label ?? '';
    this.bio = profile.bio ?? '';
  }
}
