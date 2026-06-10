import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorMessage } from '../core/http-error';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card form-card">
      <p class="eyebrow">Beveiliging</p>
      <h1>Bevestig je e-mailadres</h1>

      @if (isVerifying()) {
        <p>Verificatielink controleren...</p>
      } @else if (verified()) {
        <p class="success">Je e-mailadres is bevestigd.</p>
        @if (!session.isLoggedIn()) {
          <a routerLink="/login" class="inline-link">Nu inloggen</a>
        }
      } @else {
        <p class="muted">Open de link in de verificatiemail. Lokaal vind je die in Mailpit op poort 8025.</p>
        <label>
          E-mail
          <input [(ngModel)]="email" type="email" autocomplete="email" />
        </label>
        <button type="button" class="secondary" (click)="resend()" [disabled]="isSending()">
          {{ isSending() ? 'Versturen...' : 'Nieuwe link versturen' }}
        </button>
      }

      @if (message()) { <p class="success">{{ message() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .form-card { max-width: 620px; margin: clamp(1rem, 4vw, 2rem) auto; display: grid; gap: 1rem; }
    label { display: grid; gap: .4rem; color: #d1d5db; }
    .muted { margin: 0; color: #cbd5e1; }
    .inline-link { color: #f9a8d4; text-decoration: none; font-weight: 700; }
  `]
})
export class VerifyEmailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected email = this.session.user()?.email ?? '';
  protected readonly isVerifying = signal(false);
  protected readonly isSending = signal(false);
  protected readonly verified = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  public ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') || this.email;
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      return;
    }

    this.isVerifying.set(true);
    this.api.verifyEmail(token).subscribe({
      next: user => {
        this.verified.set(true);
        this.isVerifying.set(false);
        if (this.session.isLoggedIn()) {
          this.session.updateUser(user);
          void this.router.navigateByUrl(user.age_confirmed ? '/discover' : '/age');
        }
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'De verificatielink is ongeldig of verlopen.'));
        this.isVerifying.set(false);
      }
    });
  }

  protected resend(): void {
    if (!this.email.trim()) {
      this.error.set('Vul je e-mailadres in.');
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.resendVerification(this.email.trim()).subscribe({
      next: result => {
        this.message.set(result.message);
        this.isSending.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Een nieuwe link versturen is niet gelukt.'));
        this.isSending.set(false);
      }
    });
  }
}
