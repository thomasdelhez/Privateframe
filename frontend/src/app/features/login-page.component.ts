import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="card form-card">
      <h1>Inloggen</h1>
      <label>E-mail <input [(ngModel)]="email" type="email" /></label>
      <label>Wachtwoord <input [(ngModel)]="password" type="password" /></label>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div class="actions">
        <button type="button" (click)="login()">Login</button>
        <button class="secondary" type="button" (click)="register()">Registreer</button>
      </div>
    </section>
  `,
  styles: [`
    .form-card { max-width: 520px; margin: 3rem auto; display: grid; gap: 1rem; }
    label { display: grid; gap: .4rem; color: #d1d5db; }
    .actions { display: flex; gap: .75rem; }
    .error { color: #fca5a5; }
  `]
})
export class LoginPageComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected error = signal<string | null>(null);

  protected login(): void {
    this.error.set(null);
    this.api.login(this.email, this.password).subscribe({
      next: (result) => {
        this.session.set(result.access_value, result.user);
        void this.router.navigateByUrl(result.user.age_confirmed ? '/discover' : '/age');
      },
      error: () => this.error.set('Login mislukt')
    });
  }

  protected register(): void {
    this.error.set(null);
    this.api.register(this.email, this.password).subscribe({
      next: () => this.login(),
      error: () => this.error.set('Registreren mislukt')
    });
  }
}
