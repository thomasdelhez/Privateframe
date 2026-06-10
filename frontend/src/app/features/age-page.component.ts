import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  template: `
    <section class="card flow">
      <p class="eyebrow">Onboarding</p>
      <h1>Bevestig je toegang</h1>
      <p class="muted">
        Voor de MVP gebruiken we een eenvoudige bevestiging. Later kan deze stap gekoppeld worden aan uitgebreidere
        verificatie, logging en voorwaarden.
      </p>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <button type="button" (click)="confirm()" [disabled]="isLoading()">
        {{ isLoading() ? 'Bezig...' : 'Bevestigen en doorgaan' }}
      </button>
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; max-width: 720px; }
    .muted { margin: 0; color: #cbd5e1; }
  `]
})
export class AgePageComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.confirmAge().subscribe({
      next: () => {
        const user = this.session.user();
        if (user) {
          this.session.updateUser({ ...user, age_confirmed: true });
        }
        this.router.navigateByUrl('/discover');
      },
      error: () => {
        this.error.set('Bevestigen is niet gelukt. Controleer of je bent ingelogd en probeer opnieuw.');
        this.isLoading.set(false);
      }
    });
  }
}
