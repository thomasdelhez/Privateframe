import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AccountSession,
  ApiService,
  Profile,
  ProfileVisitSummary,
  ReportItem
} from '../core/api.service';
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
          <p>Beheer wat andere leden over je zien en volg wie je profiel recent heeft bekeken.</p>
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

              <label>
                Interesses
                <input name="interests" [(ngModel)]="interestsText" maxlength="300" placeholder="fotografie, reizen, muziek" />
                <span class="field-help">Maximaal 10, gescheiden door komma's.</span>
              </label>

              <fieldset class="privacy-settings">
                <legend>Privacy</legend>
                <label><input type="checkbox" name="discoverable" [(ngModel)]="discoverable" /><span>Mijn profiel tonen in Ontdekken</span></label>
                <label><input type="checkbox" name="showOnlineStatus" [(ngModel)]="showOnlineStatus" /><span>Mijn online status tonen</span></label>
                <label><input type="checkbox" name="showLocation" [(ngModel)]="showLocation" /><span>Mijn locatie tonen</span></label>
                <label><input type="checkbox" name="registerProfileViews" [(ngModel)]="registerProfileViews" /><span>Profielbezoeken registreren</span></label>
              </fieldset>

              <button type="submit" [disabled]="isSavingProfile() || !displayName.trim()">
                {{ isSavingProfile() ? 'Opslaan...' : 'Profiel opslaan' }}
              </button>
            </form>

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
              <h2>Geblokkeerde profielen</h2>
              @if (blockedProfiles().length === 0) {
                <p class="muted">Je hebt niemand geblokkeerd.</p>
              } @else {
                <div class="activity-list">
                  @for (blocked of blockedProfiles(); track blocked.id) {
                    <div class="activity-item">
                      <strong>{{ blocked.display_name }}</strong>
                      <button type="button" class="secondary compact-button" (click)="unblock(blocked)">Deblokkeren</button>
                    </div>
                  }
                </div>
              }
            </article>

            <article class="panel">
              <h2>Actieve sessies</h2>
              <p class="muted">Trek apparaten in die je niet meer gebruikt of herkent.</p>
              <div class="activity-list">
                @for (accountSession of sessions(); track accountSession.id) {
                  <div class="activity-item">
                    <div>
                      <strong>{{ accountSession.current ? 'Dit apparaat' : 'Andere sessie' }}</strong>
                      <p class="muted">Aangemeld {{ formatDate(accountSession.created_at) }}</p>
                    </div>
                    <button type="button" class="secondary compact-button" (click)="revoke(accountSession)">
                      Intrekken
                    </button>
                  </div>
                }
              </div>
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
    .form h2, .panel h2, .panel h3 { margin-top: 0; }
    label { display: grid; gap: .35rem; color: #cbd5e1; font-weight: 600; }
    input, textarea { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    textarea { resize: vertical; }
    .duo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
    .privacy-settings { display: grid; gap: .65rem; margin: 0; padding: 1rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: 1rem; }
    .privacy-settings label { display: flex; align-items: center; gap: .65rem; }
    .privacy-settings input { width: 1.2rem; height: 1.2rem; flex: 0 0 auto; }
    .field-help { color: #94a3b8; font-size: .85rem; font-weight: 400; }
    .compact-actions { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: flex-end; }
    .compact-actions button, .compact-button { width: auto; min-height: 2.5rem; padding: .65rem .85rem; }
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
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .title-row, .activity-item { display: grid; }
      .duo { grid-template-columns: 1fr; }
      .public-profile-link { justify-self: start; }
      .compact-actions { display: grid; justify-content: stretch; }
      .compact-actions button, .compact-button { width: 100%; }
    }
  `]
})
export class ProfilePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly activity = signal<ProfileVisitSummary | null>(null);
  protected readonly myReports = signal<ReportItem[]>([]);
  protected readonly blockedProfiles = signal<Profile[]>([]);
  protected readonly sessions = signal<AccountSession[]>([]);
  protected readonly isSavingProfile = signal(false);
  protected readonly isLoadingActivity = signal(false);
  protected readonly isLoadingReports = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activityError = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected displayName = '';
  protected locationLabel = '';
  protected ageLabel = '';
  protected gender = '';
  protected bio = '';
  protected interestsText = '';
  protected discoverable = true;
  protected showOnlineStatus = true;
  protected showLocation = true;
  protected registerProfileViews = true;

  public ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      return;
    }

    this.api.getMyProfile().subscribe({
      next: profile => {
        this.applyProfile(profile);
      },
      error: () => {
        const user = this.session.user();
        this.displayName = user?.email.split('@')[0] ?? '';
      }
    });

    this.loadActivity();
    this.loadReports();
    this.api.getBlockedProfiles().subscribe({ next: items => this.blockedProfiles.set(items), error: () => this.blockedProfiles.set([]) });
    this.api.getSessions().subscribe({ next: items => this.sessions.set(items), error: () => this.sessions.set([]) });
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
      bio: this.bio.trim() || null,
      interests: this.interestsText.split(',').map(item => item.trim()).filter(Boolean).slice(0, 10),
      discoverable: this.discoverable,
      show_online_status: this.showOnlineStatus,
      show_location: this.showLocation,
      register_profile_views: this.registerProfileViews
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

  protected unblock(profile: Profile): void {
    this.api.unblockUser(profile.user_id).subscribe({
      next: () => this.blockedProfiles.update(items => items.filter(item => item.user_id !== profile.user_id)),
      error: () => this.error.set('Deblokkeren is niet gelukt.')
    });
  }

  protected revoke(accountSession: AccountSession): void {
    this.api.revokeSession(accountSession.id).subscribe({
      next: () => {
        if (accountSession.current) {
          this.session.clear();
          window.location.assign('/login');
          return;
        }
        this.sessions.update(items => items.filter(item => item.id !== accountSession.id));
      },
      error: () => this.error.set('Sessie intrekken is niet gelukt.')
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
    this.interestsText = profile.interests.join(', ');
    this.discoverable = profile.discoverable;
    this.showOnlineStatus = profile.show_online_status;
    this.showLocation = profile.show_location;
    this.registerProfileViews = profile.register_profile_views;
  }
}
