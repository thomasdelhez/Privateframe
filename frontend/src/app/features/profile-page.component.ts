import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Profile, ProfileVisitSummary } from '../core/api.service';
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
          <p>Bouw je zichtbare profiel uit en volg wie je profiel recent heeft bekeken.</p>
        </div>
        @if (profile(); as item) {
          <a [routerLink]="['/discover', item.slug]" class="secondary-link">Bekijk publiek profiel</a>
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
          <form class="form panel" (ngSubmit)="save()">
            <h2>Basisgegevens</h2>

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

            <button type="submit" [disabled]="isSaving() || !displayName.trim()">
              {{ isSaving() ? 'Opslaan...' : 'Profiel opslaan' }}
            </button>
          </form>

          <div class="side-column">
            @if (profile(); as item) {
              <article class="preview panel">
                <h2>Preview</h2>
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
                <button type="button" class="secondary" (click)="loadActivity()" [disabled]="isLoadingActivity()">
                  Vernieuwen
                </button>
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
    .eyebrow { color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, .9fr); gap: 1rem; align-items: start; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.1rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .24); }
    .form { display: grid; gap: 1rem; }
    .form h2, .panel h2 { margin-top: 0; }
    label { display: grid; gap: .35rem; color: #cbd5e1; font-weight: 600; }
    input, textarea { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    textarea { resize: vertical; }
    .duo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
    .side-column { display: grid; gap: 1rem; }
    .preview-card { display: flex; gap: .9rem; align-items: center; }
    .avatar { display: grid; place-items: center; width: 3.5rem; height: 3.5rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899 50%, #38bdf8); color: white; font-weight: 900; flex: 0 0 auto; box-shadow: 0 10px 24px rgba(236, 72, 153, .18); }
    .muted { color: #94a3b8; }
    .meta-row { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .3rem .7rem; font-size: .92rem; font-weight: 700; }
    .activity-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .activity-head p { margin: .2rem 0 0; }
    .activity-count { margin-bottom: .9rem; color: #cbd5e1; }
    .activity-list { display: grid; gap: .75rem; }
    .activity-item { display: flex; justify-content: space-between; gap: 1rem; padding-top: .75rem; border-top: 1px solid rgba(148, 163, 184, .14); }
    .activity-item:first-child { border-top: 0; padding-top: 0; }
    .activity-item p { margin: .15rem 0 0; }
    .error { color: #991b1b; background: #fee2e2; padding: .75rem; border-radius: .5rem; }
    .success { color: #166534; background: #dcfce7; padding: .75rem; border-radius: .5rem; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .title-row { display: grid; }
      .duo { grid-template-columns: 1fr; }
      .activity-item { display: grid; }
    }
  `]
})
export class ProfilePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly activity = signal<ProfileVisitSummary | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly isLoadingActivity = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activityError = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected displayName = '';
  protected locationLabel = '';
  protected ageLabel = '';
  protected gender = '';
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

    this.loadActivity();
  }

  protected save(): void {
    this.isSaving.set(true);
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
        this.isSaving.set(false);
      },
      error: () => {
        this.error.set('Opslaan is niet gelukt. Controleer je invoer en probeer opnieuw.');
        this.isSaving.set(false);
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
