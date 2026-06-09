import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
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
        <a routerLink="/plan">Plan</a>
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
    .shell-main { max-width: 1120px; margin: 0 auto; padding: 2rem; }
  `]
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  public ngOnInit(): void {
    if (!this.session.isLoggedIn()) {
      return;
    }
    this.api.getCurrentUser().subscribe({
      next: user => this.session.updateUser(user),
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
