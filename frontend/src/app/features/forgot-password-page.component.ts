import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorMessage } from '../core/http-error';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card form-card">
      <p class="eyebrow">Account</p>
      <h1>Wachtwoord vergeten</h1>
      <p class="muted">Vul je e-mailadres in. Als het account bestaat, ontvang je een resetlink.</p>
      <label>E-mail <input [(ngModel)]="email" type="email" autocomplete="email" /></label>
      <button type="button" (click)="submit()" [disabled]="isLoading()">Resetlink aanvragen</button>
      @if (message()) { <p class="success">{{ message() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }
      <a routerLink="/login" class="inline-link">Terug naar login</a>
    </section>
  `,
  styles: [`
    .form-card { max-width: 560px; margin: clamp(1rem, 4vw, 2rem) auto; display: grid; gap: 1rem; }
    label { display: grid; gap: .4rem; color: #d1d5db; }
    .muted { margin: 0; color: #cbd5e1; }
    .inline-link { color: #f9a8d4; text-decoration: none; font-weight: 700; }
  `]
})
export class ForgotPasswordPageComponent {
  private readonly api = inject(ApiService);
  protected email = '';
  protected readonly isLoading = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (!this.email.trim()) {
      this.error.set('Vul je e-mailadres in.');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    this.api.forgotPassword(this.email.trim()).subscribe({
      next: result => {
        this.message.set(result.message);
        this.isLoading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'De resetlink aanvragen is niet gelukt.'));
        this.isLoading.set(false);
      }
    });
  }
}
