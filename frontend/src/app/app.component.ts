import { Component, OnInit, inject, signal } from '@angular/core';
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
      <button type="button" class="menu-toggle" (click)="toggleMenu()" [attr.aria-expanded]="isMenuOpen()">
        <span>{{ isMenuOpen() ? 'Sluiten' : 'Menu' }}</span>
      </button>
      <nav class="shell-nav" [class.open]="isMenuOpen()">
        <a routerLink="/discover" class="nav-link" (click)="closeMenu()">Ontdekken</a>
        <a routerLink="/profile" class="nav-link" (click)="closeMenu()">Profiel</a>
        @if (session.isLoggedIn()) {
          <a routerLink="/photos" class="nav-link" (click)="closeMenu()">Mijn foto's</a>
        }
        @if (session.isPremium()) {
          <a routerLink="/chat" class="nav-link nav-with-badge" (click)="closeMenu()">
            <span>Berichten</span>
            @if (chatPresence.unreadCount() > 0) {
              <span class="badge">{{ chatPresence.unreadCount() }}</span>
            }
          </a>
        }
        <a routerLink="/plan" class="nav-link" (click)="closeMenu()">Plan</a>
        @if (session.isAdmin()) {
          <a routerLink="/admin" class="nav-link" (click)="closeMenu()">Admin</a>
        }
        @if (session.isLoggedIn()) {
          <button class="secondary nav-logout" type="button" (click)="logout()">Uitloggen</button>
        } @else {
          <a routerLink="/login" class="nav-link nav-primary" (click)="closeMenu()">Login</a>
        }
      </nav>
    </header>
    <main class="shell-main">
      <router-outlet />
    </main>
  `,
  styles: [`
    .shell-header { display: flex; align-items: center; gap: 1rem; justify-content: space-between; padding: 1rem max(1rem, env(safe-area-inset-right)) 1rem max(1rem, env(safe-area-inset-left)); position: sticky; top: 0; backdrop-filter: blur(18px); background: rgba(3, 7, 18, 0.72); border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; }
    .brand { font-weight: 900; font-size: 1.3rem; color: #f9fafb; text-decoration: none; }
    .menu-toggle { display: none; min-height: 2.6rem; padding: .65rem .9rem; border-radius: 999px; border: 1px solid rgba(148, 163, 184, .16); background: rgba(255,255,255,.03); color: #f8fafc; font-weight: 700; }
    .shell-nav { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: .7rem; }
    .nav-link { display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem; padding: .68rem .95rem; border-radius: 999px; color: #d1d5db; text-decoration: none; background: rgba(255,255,255,.02); border: 1px solid transparent; }
    .nav-link:hover { color: #f8fafc; border-color: rgba(244, 114, 182, .2); background: rgba(244, 114, 182, .08); }
    .nav-primary { background: rgba(244, 114, 182, .16); color: #f9fafb; border-color: rgba(244, 114, 182, .22); }
    .nav-with-badge { display: inline-flex; align-items: center; gap: .45rem; }
    .badge { display: inline-flex; min-width: 1.25rem; height: 1.25rem; align-items: center; justify-content: center; padding: 0 .35rem; border-radius: 999px; background: #ec4899; color: white; font-size: .75rem; font-weight: 800; line-height: 1; box-shadow: 0 0 0 1px rgba(255,255,255,.08); }
    .nav-logout { min-height: 2.75rem; }
    .shell-main { max-width: 1180px; margin: 0 auto; padding: 1.5rem max(1rem, env(safe-area-inset-right)) calc(2rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
    @media (max-width: 820px) {
      .shell-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
      .menu-toggle { display: inline-flex; align-items: center; justify-content: center; }
      .shell-nav { grid-column: 1 / -1; display: none; justify-items: center; width: 100%; padding-top: .75rem; }
      .shell-nav.open { display: grid; grid-template-columns: minmax(0, 20rem); justify-content: center; }
      .shell-nav .nav-link, .shell-nav .nav-logout { width: 100%; }
    }
    @media (max-width: 560px) {
      .shell-main { padding-top: 1rem; }
    }
  `]
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);
  protected readonly chatPresence = inject(ChatPresenceService);
  protected readonly isMenuOpen = signal(false);

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
    this.closeMenu();
    this.api.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout()
    });
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  private finishLogout(): void {
    this.session.clear();
    this.closeMenu();
    void this.router.navigateByUrl('/');
  }
}
