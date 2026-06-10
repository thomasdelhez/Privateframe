import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, AdminPost, AdminReportContext, AdminUser, AuditLogEntry, ChatMessage, ReportItem } from '../core/api.service';
import { AuthenticatedImageDirective } from '../core/authenticated-image.directive';

@Component({
  standalone: true,
  imports: [RouterLink, AuthenticatedImageDirective],
  template: `
    <section class="card flow">
      <div class="hero">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>Moderatie en beheer</h1>
          <p>Je kunt nu doorklikken naar context, profielen en postdetails in plaats van alleen losse IDs te zien.</p>
        </div>
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (success()) {
        <p class="success">{{ success() }}</p>
      }

      <div class="stats">
        <article class="stat">
          <strong>{{ openReportsCount() }}</strong>
          <span>Open meldingen</span>
        </article>
        <article class="stat">
          <strong>{{ restrictedUsersCount() }}</strong>
          <span>Beperkt / geblokkeerd</span>
        </article>
        <article class="stat">
          <strong>{{ flaggedPostsCount() }}</strong>
          <span>Verborgen / verwijderd</span>
        </article>
        <article class="stat">
          <strong>{{ audit().length }}</strong>
          <span>Auditacties</span>
        </article>
      </div>

      <div class="explain-grid">
        <article class="mini-card">
          <strong>Restrict</strong>
          <p>Gebruiker kan nog inloggen, maar niet meer ontdekken, chatten, posten of uploads doen.</p>
        </article>
        <article class="mini-card">
          <strong>Ban</strong>
          <p>Gebruiker verliest volledige toegang tot het account.</p>
        </article>
        <article class="mini-card">
          <strong>Verberg</strong>
          <p>Post verdwijnt van publieke profielen, maar blijft intern zichtbaar voor review en audit.</p>
        </article>
        <article class="mini-card">
          <strong>Verwijder</strong>
          <p>Sterkere takedown: post wordt als verwijderd gemarkeerd en blijft alleen nog voor auditspoor bestaan.</p>
        </article>
      </div>

      <div class="grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Meldingen</h2>
              <p class="muted">Klik op een melding om de context te openen.</p>
            </div>
          </div>

          @if (isLoading()) {
            <p>Data laden...</p>
          } @else if (reports().length === 0) {
            <p class="muted">Geen meldingen gevonden.</p>
          } @else {
            <div class="list">
              @for (report of reports(); track report.id) {
                <button type="button" class="item item-button" (click)="openReportContext(report.id)">
                  <div class="row">
                    <div>
                      <strong>{{ report.target_type }} · {{ report.reason.replaceAll('_', ' ') }}</strong>
                      <p class="muted">Klik om context, betrokken profiel of gesprek te bekijken.</p>
                    </div>
                    <span class="pill" [class.good]="report.status === 'resolved'">{{ report.status }}</span>
                  </div>
                  @if (report.description) {
                    <p>{{ report.description }}</p>
                  }
                  <div class="row">
                    <span class="muted">{{ formatDate(report.created_at) }}</span>
                    @if (report.status === 'open') {
                      <span class="linkish">Open context</span>
                    }
                  </div>
                </button>
              }
            </div>
          }
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Gebruikers</h2>
              <p class="muted">Klik door naar profiel, of neem direct moderation-acties.</p>
            </div>
          </div>

          @if (isLoading()) {
            <p>Gebruikers laden...</p>
          } @else {
            <div class="list">
              @for (user of users(); track user.id) {
                <article class="item">
                  <div class="row">
                    <div>
                      <strong>{{ user.display_name || user.email }}</strong>
                      <p class="muted">{{ user.email }}</p>
                      <p class="muted">{{ user.role }} · {{ user.subscription_status }}</p>
                    </div>
                    <span class="pill" [class.warn]="user.status !== 'active'">{{ user.status }}</span>
                  </div>
                  <div class="row user-footer">
                    <span class="muted">{{ formatDate(user.created_at) }}</span>
                    <div class="moderation-actions">
                      @if (user.profile_slug) {
                        <a class="moderation-action profile-action" [routerLink]="['/discover', user.profile_slug]">Open profiel</a>
                      } @else {
                        <button type="button" class="moderation-action profile-action" disabled>Geen profiel</button>
                      }
                      @if (user.status === 'active') {
                        <button type="button" class="moderation-action restrict-action" (click)="restrictUser(user.id); $event.stopPropagation()">Restrict</button>
                        <button type="button" class="moderation-action ban-action" (click)="banUser(user.id); $event.stopPropagation()">Ban</button>
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Posts</h2>
              <p class="muted">Klik op een post voor detail en preview.</p>
            </div>
          </div>

          @if (isLoading()) {
            <p>Posts laden...</p>
          } @else {
            <div class="list">
              @for (post of posts(); track post.id) {
                <button type="button" class="item item-button" (click)="openPostDetail(post.id)">
                  <div class="row">
                    <div>
                      <strong>{{ post.title }}</strong>
                      <p class="muted">
                        {{ post.display_name || 'Onbekende gebruiker' }}
                        @if (post.profile_slug) {
                          · /{{ post.profile_slug }}
                        }
                      </p>
                    </div>
                    <span class="pill" [class.warn]="post.status !== 'published'">{{ post.status }}</span>
                  </div>
                  <div class="row">
                    <span class="muted">{{ formatDate(post.created_at) }}</span>
                    <div class="actions">
                      <span class="linkish">Open post</span>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Auditlog</h2>
              <p class="muted">Laatste moderation acties.</p>
            </div>
          </div>

          @if (isLoading()) {
            <p>Auditlog laden...</p>
          } @else if (audit().length === 0) {
            <p class="muted">Nog geen auditregels.</p>
          } @else {
            <div class="list">
              @for (entry of audit(); track entry.id) {
                <article class="item">
                  <div class="row">
                    <strong>{{ entry.action }}</strong>
                    <span class="pill">{{ entry.entity_type }}</span>
                  </div>
                  <p class="muted">
                    Object:
                    @if (entry.entity_label) {
                      {{ entry.entity_label }}
                    } @else {
                      {{ entry.entity_type }}
                    }
                  </p>
                  <p class="muted">
                    Actor:
                    @if (entry.actor) {
                      {{ entry.actor.display_name || entry.actor.email }}
                    } @else {
                      Systeem of onbekend account
                    }
                  </p>
                  @if (entry.entity_route) {
                    <a class="secondary action-link" [routerLink]="entry.entity_route">Open gerelateerd profiel</a>
                  }
                  <span class="muted">{{ formatDate(entry.created_at) }}</span>
                </article>
              }
            </div>
          }
        </section>
      </div>
    </section>

    @if (activeReportContext(); as context) {
      <div class="modal-backdrop" (click)="closeReportContext()">
        <section class="modal panel" (click)="$event.stopPropagation()">
          <div class="panel-head">
            <div>
              <h2>Melding context</h2>
              <p class="muted">
                {{ context.report.target_type }} · {{ context.report.reason.replaceAll('_', ' ') }} · {{ context.report.status }}
              </p>
            </div>
            <div class="actions">
              @if (context.report.status === 'open') {
                <button type="button" (click)="resolveReport(context.report.id)">Markeer als opgelost</button>
              }
              <button type="button" class="secondary" (click)="closeReportContext()">Sluiten</button>
            </div>
          </div>

          @if (context.report.description) {
            <article class="context-card">
              <h3>Omschrijving</h3>
              <p>{{ context.report.description }}</p>
            </article>
          }

          @if (context.profile) {
            <article class="context-card">
              <h3>Profiel</h3>
              <p><strong>{{ context.profile.display_name }}</strong> · /{{ context.profile.slug }}</p>
              <a class="secondary action-link" [routerLink]="['/discover', context.profile.slug]" (click)="closeReportContext()">Open profiel</a>
            </article>
          }

          @if (context.post; as post) {
            <article class="context-card">
              <div class="row">
                <div>
                  <h3>Post</h3>
                  <p><strong>{{ post.title }}</strong></p>
                  @if (post.description) {
                    <p>{{ post.description }}</p>
                  }
                </div>
                @if (post.profile_slug) {
                  <a class="secondary action-link" [routerLink]="['/discover', post.profile_slug]" (click)="closeReportContext()">Open profiel</a>
                }
              </div>
              @if (post.assets?.length) {
                <div class="asset-grid">
                  @for (asset of post.assets; track asset.id) {
                    <img
                      [appAuthenticatedSrc]="asset.url"
                      [previewSrc]="asset.preview_url"
                      alt="Post preview"
                    />
                  }
                </div>
              }
            </article>
          }

          @if (context.conversation; as conversation) {
            <article class="context-card conversation-context">
              <div class="conversation-summary">
                <div>
                  <h3>Volledige conversatie</h3>
                  <p class="muted">
                    {{ context.message_count ?? context.messages?.length ?? 0 }} berichten ·
                    {{ conversation.status }} · bijgewerkt {{ formatDate(conversation.updated_at) }}
                  </p>
                </div>
                @if (context.reporter) {
                  <span class="reporter-label">
                    Gemeld door {{ context.reporter.display_name || context.reporter.email }}
                  </span>
                }
              </div>

              <div class="participant-row">
                @for (participant of conversation.participants; track participant.id) {
                  <div class="participant">
                    <strong>{{ participant.display_name || participant.email }}</strong>
                    <p class="muted">{{ participant.email }}</p>
                    @if (participant.profile_slug) {
                      <a class="participant-link" [routerLink]="['/discover', participant.profile_slug]" (click)="closeReportContext()">Open profiel</a>
                    }
                  </div>
                }
              </div>

              <div class="conversation-transcript">
                @if (!context.messages?.length) {
                  <p class="muted">Er staan geen berichten in deze conversatie.</p>
                } @else {
                  @for (message of context.messages; track message.id) {
                    <div
                      class="transcript-row"
                      [class.alternate]="message.sender_id === conversation.user_b_id"
                      [class.reported]="message.id === context.reported_message_id">
                      <div class="message-item">
                        <div class="message-head">
                          <strong>{{ senderLabel(message.sender_id, conversation.participants) }}</strong>
                          <span class="muted">{{ formatDate(message.created_at) }}</span>
                        </div>
                        <p>{{ message.body }}</p>
                        @if (message.id === context.reported_message_id) {
                          <span class="reported-label">Dit bericht is gemeld</span>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            </article>
          }
        </section>
      </div>
    }

    @if (activePost(); as post) {
      <div class="modal-backdrop" (click)="closePostDetail()">
        <section class="modal panel" (click)="$event.stopPropagation()">
          <div class="panel-head">
            <div>
              <h2>{{ post.title }}</h2>
              <p class="muted">{{ post.status }} · {{ formatDate(post.created_at) }}</p>
            </div>
            <div class="actions">
              @if (post.profile_slug) {
                <a class="secondary action-link" [routerLink]="['/discover', post.profile_slug]" (click)="closePostDetail()">Open profiel</a>
              }
              <button type="button" class="secondary" (click)="closePostDetail()">Sluiten</button>
            </div>
          </div>

          @if (post.description) {
            <p>{{ post.description }}</p>
          }

          @if (post.assets?.length) {
            <div class="asset-grid">
              @for (asset of post.assets; track asset.id) {
                <img
                  [appAuthenticatedSrc]="asset.url"
                  [previewSrc]="asset.preview_url"
                  alt="Post asset"
                />
              }
            </div>
          } @else {
            <p class="muted">Geen assets op deze post gevonden.</p>
          }

          <div class="action-explainer">
            <p><strong>Verberg:</strong> haalt de post weg uit publieke weergaves, maar bewaart hem voor review.</p>
            <p><strong>Verwijder:</strong> markeert de post als verwijderd voor een hardere takedown.</p>
          </div>

          <div class="actions">
            @if (post.status === 'published') {
              <button type="button" class="secondary" (click)="hidePost(post.id)">Verberg</button>
              <button type="button" (click)="removePost(post.id)">Verwijder</button>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; }
    .hero { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(30, 41, 59, .92) 55%, rgba(9, 9, 11, .94)); border: 1px solid rgba(148, 163, 184, .14); color: #f8fafc; }
    .eyebrow { margin: 0 0 .25rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .stats, .explain-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .stat, .mini-card { display: grid; gap: .35rem; padding: 1rem; border-radius: 1.1rem; border: 1px solid rgba(148, 163, 184, .14); background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .2); }
    .stat strong { font-size: 1.8rem; }
    .mini-card p { margin: 0; color: #cbd5e1; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.1rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .24); }
    .panel-head, .row, .actions { display: flex; justify-content: space-between; gap: .75rem; align-items: flex-start; }
    .list, .message-list { display: grid; gap: .75rem; margin-top: 1rem; }
    .item { display: grid; gap: .45rem; padding: 1rem; border-radius: 1rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .76); }
    .item-button { width: 100%; text-align: left; color: inherit; }
    .item-button:hover { border-color: rgba(251, 191, 36, .25); }
    .muted { color: #94a3b8; margin: 0; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .28rem .65rem; font-size: .82rem; font-weight: 700; }
    .pill.warn { color: #fcd34d; border-color: rgba(251, 191, 36, .25); }
    .pill.good { color: #86efac; border-color: rgba(34, 197, 94, .22); }
    .linkish { color: #fbbf24; font-weight: 700; }
    .action-link { text-decoration: none; }
    .user-footer { display: grid; grid-template-columns: minmax(0, 1fr); gap: .65rem; width: 100%; }
    .moderation-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .55rem; width: 100%; }
    .moderation-action { display: inline-flex; align-items: center; justify-content: center; min-height: 2.65rem; width: 100%; padding: .68rem .75rem; border: 1px solid rgba(148, 163, 184, .25); border-radius: .8rem; background: rgba(15, 23, 42, .9); box-shadow: none; color: #f8fafc; font-weight: 800; text-decoration: none; }
    .moderation-action:hover { transform: translateY(-1px); }
    .profile-action { border-color: rgba(56, 189, 248, .3); color: #bae6fd; }
    .restrict-action { border-color: rgba(251, 191, 36, .32); color: #fde68a; }
    .ban-action { border-color: rgba(248, 113, 113, .36); color: #fecaca; background: rgba(127, 29, 29, .18); }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    .modal-backdrop { position: fixed; inset: 0; display: grid; place-items: center; padding: 1.5rem; background: rgba(2, 6, 23, .78); backdrop-filter: blur(8px); z-index: 120; }
    .modal { width: min(920px, 100%); max-height: min(84vh, 980px); overflow: auto; display: grid; gap: 1rem; }
    .context-card { display: grid; gap: .75rem; padding: 1rem; border-radius: 1rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .72); }
    .context-card h3, .context-card p { margin: 0; }
    .conversation-context { gap: 1rem; }
    .conversation-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .reporter-label, .reported-label { display: inline-flex; width: fit-content; padding: .3rem .6rem; border-radius: 999px; border: 1px solid rgba(251, 191, 36, .28); background: rgba(120, 53, 15, .22); color: #fde68a; font-size: .78rem; font-weight: 800; }
    .participant-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem; }
    .participant { display: grid; gap: .35rem; padding: .9rem; border-radius: .9rem; background: rgba(2, 6, 23, .56); border: 1px solid rgba(148, 163, 184, .14); }
    .participant-link { color: #bae6fd; font-weight: 800; text-decoration: none; }
    .conversation-transcript { display: grid; gap: .7rem; padding: .85rem; border-radius: 1rem; background: rgba(2, 6, 23, .48); border: 1px solid rgba(148, 163, 184, .12); }
    .transcript-row { display: flex; justify-content: flex-start; }
    .transcript-row.alternate { justify-content: flex-end; }
    .transcript-row.reported .message-item { border-color: rgba(251, 191, 36, .46); box-shadow: 0 0 0 2px rgba(251, 191, 36, .08); }
    .message-item { display: grid; gap: .45rem; padding: .85rem 1rem; border-radius: .9rem; background: rgba(2, 6, 23, .56); border: 1px solid rgba(148, 163, 184, .14); }
    .transcript-row .message-item { width: min(82%, 620px); background: rgba(15, 23, 42, .9); }
    .transcript-row.alternate .message-item { background: rgba(76, 29, 149, .2); border-color: rgba(192, 132, 252, .2); }
    .message-head { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; }
    .message-item p { margin: 0; color: #e2e8f0; white-space: pre-wrap; }
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; }
    .asset-grid img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: .9rem; border: 1px solid rgba(148, 163, 184, .16); background: #020617; }
    .action-explainer { display: grid; gap: .45rem; color: #cbd5e1; }
    .action-explainer p { margin: 0; }
    @media (max-width: 980px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .explain-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .flow { gap: .8rem; }
      .hero { display: grid; padding: 1.1rem; border-radius: 1.15rem; }
      .stats { gap: .65rem; }
      .stat { min-height: 98px; padding: .8rem; }
      .stat strong { font-size: 1.55rem; }
      .stat span { font-size: .86rem; color: #cbd5e1; }
      .explain-grid { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 78vw); grid-template-columns: none; overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: inline mandatory; padding: .1rem .1rem .55rem; scrollbar-width: thin; }
      .mini-card { scroll-snap-align: start; min-height: 140px; }
      .panel { padding: .85rem; border-radius: 1rem; }
      .panel-head { display: grid; }
      .row { display: grid; gap: .55rem; }
      .row > .pill { justify-self: start; }
      .item { padding: .85rem; }
      .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
      .actions > * { width: 100%; min-width: 0; }
      .item .actions { margin-top: .25rem; }
      .user-footer { justify-content: stretch; }
      .moderation-actions { margin-top: .25rem; justify-self: stretch; }
      .item-button { border-radius: .9rem; }
      .modal-backdrop { align-items: end; padding: .6rem; }
      .modal { width: 100%; max-height: 90dvh; border-radius: 1.25rem 1.25rem .65rem .65rem; padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
      .modal .panel-head { position: sticky; top: -.85rem; z-index: 3; margin: -.85rem -.85rem 0; padding: .9rem; border-bottom: 1px solid rgba(148, 163, 184, .14); background: rgba(2, 6, 23, .97); }
      .participant-row, .asset-grid { grid-template-columns: 1fr; }
      .conversation-summary { display: grid; }
      .transcript-row .message-item { width: 92%; }
    }
    @media (max-width: 480px) {
      .actions { grid-template-columns: 1fr; }
      .moderation-actions { grid-template-columns: 1fr; }
      .context-card { padding: .85rem; }
      .message-head { display: grid; gap: .15rem; }
      .transcript-row .message-item { width: 100%; }
    }
  `]
})
export class AdminPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly reports = signal<ReportItem[]>([]);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly posts = signal<AdminPost[]>([]);
  protected readonly audit = signal<AuditLogEntry[]>([]);
  protected readonly activeReportContext = signal<AdminReportContext | null>(null);
  protected readonly activePost = signal<AdminPost | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  public ngOnInit(): void {
    this.loadAll();
  }

  protected loadAll(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.success.set(null);

    let completed = 0;
    const done = () => {
      completed += 1;
      if (completed === 4) {
        this.isLoading.set(false);
      }
    };

    this.api.getAdminReports().subscribe({
      next: reports => {
        this.reports.set(reports);
        done();
      },
      error: () => {
        this.error.set('Admingegevens laden is niet gelukt.');
        done();
      }
    });

    this.api.getAdminUsers().subscribe({
      next: users => {
        this.users.set(users);
        done();
      },
      error: () => done()
    });

    this.api.getAdminPosts().subscribe({
      next: posts => {
        this.posts.set(posts);
        done();
      },
      error: () => done()
    });

    this.api.getAuditLog().subscribe({
      next: audit => {
        this.audit.set(audit);
        done();
      },
      error: () => done()
    });
  }

  protected openReportContext(reportId: string): void {
    this.api.getAdminReportContext(reportId).subscribe({
      next: context => this.activeReportContext.set(context),
      error: () => this.error.set('Meldingcontext laden is niet gelukt.')
    });
  }

  protected closeReportContext(): void {
    this.activeReportContext.set(null);
  }

  protected openPostDetail(postId: string): void {
    this.api.getAdminPost(postId).subscribe({
      next: post => this.activePost.set(post),
      error: () => this.error.set('Postdetail laden is niet gelukt.')
    });
  }

  protected closePostDetail(): void {
    this.activePost.set(null);
  }

  protected resolveReport(reportId: string): void {
    this.api.resolveReport(reportId).subscribe({
      next: updated => {
        this.reports.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.activeReportContext.update(context => context && context.report.id === updated.id ? { ...context, report: updated } : context);
        this.success.set('Melding gemarkeerd als opgelost.');
      },
      error: () => this.error.set('Melding oplossen is niet gelukt.')
    });
  }

  protected restrictUser(userId: string): void {
    this.api.restrictUser(userId).subscribe({
      next: updated => {
        this.users.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.success.set('Gebruiker is restricted en kan geen discover/chat/posts meer gebruiken.');
      },
      error: () => this.error.set('Gebruiker restrict’en is niet gelukt.')
    });
  }

  protected banUser(userId: string): void {
    this.api.banUser(userId).subscribe({
      next: updated => {
        this.users.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.success.set('Gebruiker is geband en verliest toegang tot het account.');
      },
      error: () => this.error.set('Gebruiker bannen is niet gelukt.')
    });
  }

  protected hidePost(postId: string): void {
    this.api.hidePost(postId).subscribe({
      next: updated => {
        this.posts.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.activePost.update(post => post && post.id === updated.id ? { ...post, status: updated.status } : post);
        this.success.set('Post is verborgen en niet meer publiek zichtbaar.');
      },
      error: () => this.error.set('Post verbergen is niet gelukt.')
    });
  }

  protected removePost(postId: string): void {
    this.api.removePost(postId).subscribe({
      next: updated => {
        this.posts.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.activePost.update(post => post && post.id === updated.id ? { ...post, status: updated.status } : post);
        this.success.set('Post is verwijderd als moderation takedown.');
      },
      error: () => this.error.set('Post verwijderen is niet gelukt.')
    });
  }

  protected openReportsCount(): number {
    return this.reports().filter(item => item.status === 'open').length;
  }

  protected restrictedUsersCount(): number {
    return this.users().filter(item => item.status !== 'active').length;
  }

  protected flaggedPostsCount(): number {
    return this.posts().filter(item => item.status !== 'published').length;
  }

  protected senderLabel(senderId: string, participants: AdminUser[]): string {
    const participant = participants.find(item => item.id === senderId);
    return participant?.display_name || participant?.email || senderId.slice(0, 8);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }
}
