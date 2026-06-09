import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService, AdminPost, AdminUser, AuditLogEntry, ReportItem } from '../core/api.service';

@Component({
  standalone: true,
  template: `
    <section class="card flow">
      <div class="hero">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>Moderatie en beheer</h1>
          <p>Hier pak je meldingen op, kun je accounts beperken en posts verbergen of verwijderen.</p>
        </div>
        <button type="button" class="secondary" (click)="loadAll()" [disabled]="isLoading()">Verversen</button>
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
          <span>Restricted / banned</span>
        </article>
        <article class="stat">
          <strong>{{ flaggedPostsCount() }}</strong>
          <span>Verborgen / verwijderd</span>
        </article>
        <article class="stat">
          <strong>{{ audit().length }}</strong>
          <span>Audit events</span>
        </article>
      </div>

      <div class="grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Meldingen</h2>
              <p class="muted">Nieuwste reports voor snelle triage.</p>
            </div>
          </div>

          @if (isLoading()) {
            <p>Data laden...</p>
          } @else if (reports().length === 0) {
            <p class="muted">Geen meldingen gevonden.</p>
          } @else {
            <div class="list">
              @for (report of reports(); track report.id) {
                <article class="item">
                  <div class="row">
                    <div>
                      <strong>{{ report.target_type }} · {{ report.reason.replaceAll('_', ' ') }}</strong>
                      <p class="muted">Target: {{ report.target_id }}</p>
                    </div>
                    <span class="pill" [class.good]="report.status === 'resolved'">{{ report.status }}</span>
                  </div>
                  @if (report.description) {
                    <p>{{ report.description }}</p>
                  }
                  <div class="row">
                    <span class="muted">{{ formatDate(report.created_at) }}</span>
                    @if (report.status === 'open') {
                      <button type="button" (click)="resolveReport(report.id)">Markeer als opgelost</button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Gebruikers</h2>
              <p class="muted">Snel ingrijpen op accounts die uit de bocht vliegen.</p>
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
                      <strong>{{ user.email }}</strong>
                      <p class="muted">{{ user.role }} · {{ user.subscription_status }}</p>
                    </div>
                    <span class="pill" [class.warn]="user.status !== 'active'">{{ user.status }}</span>
                  </div>
                  <div class="row">
                    <span class="muted">{{ formatDate(user.created_at) }}</span>
                    <div class="actions">
                      @if (user.status === 'active') {
                        <button type="button" class="secondary" (click)="restrictUser(user.id)">Restrict</button>
                        <button type="button" (click)="banUser(user.id)">Ban</button>
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
              <p class="muted">Moderatie op galerijen en uploads.</p>
            </div>
          </div>

          @if (isLoading()) {
            <p>Posts laden...</p>
          } @else {
            <div class="list">
              @for (post of posts(); track post.id) {
                <article class="item">
                  <div class="row">
                    <div>
                      <strong>{{ post.title }}</strong>
                      <p class="muted">User: {{ post.user_id }}</p>
                    </div>
                    <span class="pill" [class.warn]="post.status !== 'published'">{{ post.status }}</span>
                  </div>
                  <div class="row">
                    <span class="muted">{{ formatDate(post.created_at) }}</span>
                    <div class="actions">
                      @if (post.status === 'published') {
                        <button type="button" class="secondary" (click)="hidePost(post.id)">Verberg</button>
                        <button type="button" (click)="removePost(post.id)">Verwijder</button>
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
                  <p class="muted">Entity: {{ entry.entity_id }}</p>
                  <p class="muted">Actor: {{ entry.actor_user_id }}</p>
                  <span class="muted">{{ formatDate(entry.created_at) }}</span>
                </article>
              }
            </div>
          }
        </section>
      </div>
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; }
    .hero { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(30, 41, 59, .92) 55%, rgba(9, 9, 11, .94)); border: 1px solid rgba(148, 163, 184, .14); color: #f8fafc; }
    .eyebrow { margin: 0 0 .25rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .stat { display: grid; gap: .35rem; padding: 1rem; border-radius: 1.1rem; border: 1px solid rgba(148, 163, 184, .14); background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .2); }
    .stat strong { font-size: 1.8rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.1rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .24); }
    .panel-head, .row, .actions { display: flex; justify-content: space-between; gap: .75rem; align-items: flex-start; }
    .list { display: grid; gap: .75rem; margin-top: 1rem; }
    .item { display: grid; gap: .45rem; padding: 1rem; border-radius: 1rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .76); }
    .muted { color: #94a3b8; margin: 0; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .28rem .65rem; font-size: .82rem; font-weight: 700; }
    .pill.warn { color: #fcd34d; border-color: rgba(251, 191, 36, .25); }
    .pill.good { color: #86efac; border-color: rgba(34, 197, 94, .22); }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    @media (max-width: 980px) {
      .stats, .grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .hero, .panel-head, .row, .actions { display: grid; }
    }
  `]
})
export class AdminPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly reports = signal<ReportItem[]>([]);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly posts = signal<AdminPost[]>([]);
  protected readonly audit = signal<AuditLogEntry[]>([]);
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

  protected resolveReport(reportId: string): void {
    this.api.resolveReport(reportId).subscribe({
      next: updated => {
        this.reports.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.success.set('Melding gemarkeerd als opgelost.');
      },
      error: () => this.error.set('Melding oplossen is niet gelukt.')
    });
  }

  protected restrictUser(userId: string): void {
    this.api.restrictUser(userId).subscribe({
      next: updated => {
        this.users.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.success.set('Gebruiker is restricted.');
      },
      error: () => this.error.set('Gebruiker restrict’en is niet gelukt.')
    });
  }

  protected banUser(userId: string): void {
    this.api.banUser(userId).subscribe({
      next: updated => {
        this.users.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.success.set('Gebruiker is geband.');
      },
      error: () => this.error.set('Gebruiker bannen is niet gelukt.')
    });
  }

  protected hidePost(postId: string): void {
    this.api.hidePost(postId).subscribe({
      next: updated => {
        this.posts.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.success.set('Post is verborgen.');
      },
      error: () => this.error.set('Post verbergen is niet gelukt.')
    });
  }

  protected removePost(postId: string): void {
    this.api.removePost(postId).subscribe({
      next: updated => {
        this.posts.update(items => items.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
        this.success.set('Post is verwijderd.');
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

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }
}
