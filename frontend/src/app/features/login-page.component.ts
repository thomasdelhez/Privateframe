import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorMessage } from '../core/http-error';
import { CurrentUser, SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card form-card">
      <div>
        <p class="eyebrow">Account</p>
        <h1>Inloggen of registreren</h1>
        <p class="muted">Gebruik minimaal 10 tekens voor een nieuw wachtwoord.</p>
      </div>

      <label>E-mail <input [(ngModel)]="email" type="email" autocomplete="email" /></label>
      <label>Wachtwoord <input [(ngModel)]="password" type="password" autocomplete="current-password" /></label>

      @if (error()) { <p class="error">{{ error() }}</p> }

      <div class="actions-row">
        <button type="button" (click)="login()" [disabled]="isLoading()">Login</button>
        <button class="secondary" type="button" (click)="register()" [disabled]="isLoading()">Registreer</button>
      </div>
      <a routerLink="/forgot-password" class="inline-link">Wachtwoord vergeten?</a>
    </section>
  `,
  styles: [`
    .form-card { max-width: 520px; margin: clamp(1rem, 4vw, 3rem) auto; display: grid; gap: 1rem; }
    label { display: grid; gap: .4rem; color: #d1d5db; }
    .muted { margin: 0; color: #cbd5e1; }
    .inline-link { color: #f9a8d4; text-decoration: none; font-weight: 700; }
  `]
})
export class LoginPageComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly error = signal<string | null>(null);
  protected readonly isLoading = signal(false);

  protected login(): void {
    if (!this.email.trim() || !this.password) {
      this.error.set('Vul je e-mailadres en wachtwoord in.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.api.login(this.email.trim(), this.password).subscribe({
      next: result => {
        this.session.set(result.access_value, result.user);
        this.isLoading.set(false);
        this.continueFor(result.user);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Login mislukt.'));
        this.isLoading.set(false);
      }
    });
  }

  protected register(): void {
    if (this.password.length < 10) {
      this.error.set('Een wachtwoord moet minimaal 10 tekens bevatten.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.api.register(this.email.trim(), this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.login();
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Registreren is niet gelukt.'));
        this.isLoading.set(false);
      }
    });
  }

  private continueFor(user: CurrentUser): void {
    if (!user.email_verified) {
      void this.router.navigate(['/verify-email'], { queryParams: { email: user.email } });
      return;
    }
    if (!user.age_confirmed) {
      void this.router.navigateByUrl('/age');
      return;
    }
    void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/discover');
  }
}
