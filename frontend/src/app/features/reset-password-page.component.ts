import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorMessage } from '../core/http-error';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card form-card">
      <p class="eyebrow">Account</p>
      <h1>Nieuw wachtwoord kiezen</h1>

      @if (!token) {
        <p class="error">Er ontbreekt een geldige resettoken.</p>
      } @else if (message()) {
        <p class="success">{{ message() }}</p>
        <a routerLink="/login" class="inline-link">Inloggen met je nieuwe wachtwoord</a>
      } @else {
        <label>Nieuw wachtwoord <input [(ngModel)]="password" type="password" autocomplete="new-password" /></label>
        <label>Herhaal wachtwoord <input [(ngModel)]="confirmation" type="password" autocomplete="new-password" /></label>
        <button type="button" (click)="submit()" [disabled]="isLoading()">Wachtwoord wijzigen</button>
      }

      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .form-card { max-width: 560px; margin: clamp(1rem, 4vw, 2rem) auto; display: grid; gap: 1rem; }
    label { display: grid; gap: .4rem; color: #d1d5db; }
    .inline-link { color: #f9a8d4; text-decoration: none; font-weight: 700; }
  `]
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected token = '';
  protected password = '';
  protected confirmation = '';
  protected readonly isLoading = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  public ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  protected submit(): void {
    if (this.password.length < 10) {
      this.error.set('Een wachtwoord moet minimaal 10 tekens bevatten.');
      return;
    }
    if (this.password !== this.confirmation) {
      this.error.set('De wachtwoorden zijn niet gelijk.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.api.resetPassword(this.token, this.password).subscribe({
      next: result => {
        this.message.set(result.message);
        this.isLoading.set(false);
      },
      error: error => {
        this.error.set(apiErrorMessage(error, 'Het wachtwoord wijzigen is niet gelukt.'));
        this.isLoading.set(false);
      }
    });
  }
}
