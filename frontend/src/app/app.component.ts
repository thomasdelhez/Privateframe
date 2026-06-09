import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { ChatPresenceService } from './core/chat-presence.service';
import { SessionService } from './core/session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="shell-header">
      <a routerLink="/" class="brand">PrivateFrame</a>
      <nav>
        <a routerLink="/discover">Ontdekken</a>
        <a routerLink="/profile">Profiel</a>
        @if (session.isPremium()) {
          <a routerLink="/chat" class="nav-with-badge">
            <span>Berichten</span>
            @if (chatPresence.unreadCount() > 0) {
              <span class="badge">{{ chatPresence.unreadCount() }}</span>
            }
          </a>
        }
        <a routerLink="/plan">Plan</a>
        @if (session.isAdmin()) {
          <a routerLink="/admin">Admin</a>
        }
        @if (session.isLoggedIn()) {
          <button class="secondary" type="button" (click)="logout()">Uitloggen</button>
        } @else {
          <a routerLink="/login">Login</a>
        }
      </nav>
    </header>
    <main class="shell-main">
      <router-outlet />
    </main>
  `,
  styles: [`
    .shell-header { display: flex; align-items: center; gap: 1rem; justify-content: space-between; padding: 1rem 2rem; position: sticky; top: 0; backdrop-filter: blur(18px); background: rgba(3, 7, 18, 0.72); border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; }
    .brand { font-weight: 900; font-size: 1.3rem; color: #f9fafb; text-decoration: none; }
    nav { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; }
    nav a { color: #d1d5db; text-decoration: none; }
    nav a:hover { color: #f472b6; }
    .nav-with-badge { display: inline-flex; align-items: center; gap: .45rem; }
    .badge { display: inline-flex; min-width: 1.25rem; height: 1.25rem; align-items: center; justify-content: center; padding: 0 .35rem; border-radius: 999px; background: #ec4899; color: white; font-size: .75rem; font-weight: 800; line-height: 1; box-shadow: 0 0 0 1px rgba(255,255,255,.08); }
    .shell-main { max-width: 1120px; margin: 0 auto; padding: 2rem; }
  `]
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);
  protected readonly chatPresence = inject(ChatPresenceService);

  public ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      return;
    }
    this.api.getCurrentUser().subscribe({
      next: user => {
        this.session.updateUser(user);
        this.chatPresence.refreshUnreadCount();
      },
      error: () => this.finishLogout()
    });
  }

  protected logout(): void {
    this.api.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout()
    });
  }

  private finishLogout(): void {
    this.session.clear();
    void this.router.navigateByUrl('/');
  }
}
