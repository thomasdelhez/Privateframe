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
      <p>Vul je e-mailadres in. Als het account bestaat, ontvang je een resetlink.</p>
      <label>E-mail <input [(ngModel)]="email" type="email" autocomplete="email" /></label>
      <button type="button" (click)="submit()" [disabled]="isLoading()">Resetlink aanvragen</button>
      @if (message()) { <p class="success">{{ message() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }
      <a routerLink="/login">Terug naar login</a>
    </section>
  `,
  styles: [`
    .form-card { max-width: 560px; margin: 2rem auto; display: grid; gap: 1rem; }
    .eyebrow { color: #f472b6; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    label { display: grid; gap: .4rem; color: #d1d5db; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    a { color: #f9a8d4; }
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
