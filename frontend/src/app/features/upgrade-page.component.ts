import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="card flow">
      <p class="eyebrow">Accountplan</p>
      <h1>Plan beheren</h1>
      <p>
        In deze MVP schakelt deze knop de uitgebreide accountmodus direct aan of uit. Later kan dit worden gekoppeld
        aan een echte provider en abonnementsstatussen.
      </p>

      @if (session.user(); as user) {
        <div class="status">
          <strong>Huidige rol:</strong> {{ user.role }}<br />
          <strong>Status:</strong> {{ user.subscription_status }}
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        @if (session.isPremium()) {
          <button type="button" class="secondary" (click)="disable()" [disabled]="isLoading()">
            Uitgebreide modus uitschakelen
          </button>
        } @else {
          <button type="button" (click)="enable()" [disabled]="isLoading()">
            Uitgebreide modus inschakelen
          </button>
        }
      } @else {
        <p>Log eerst in om je plan te beheren.</p>
        <a routerLink="/login">Naar login</a>
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; max-width: 720px; }
    .eyebrow { color: #f472b6; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .status { background: rgba(255,255,255,.06); padding: 1rem; border-radius: .75rem; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
  `]
})
export class PlanPageComponent {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected enable(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.api.enablePremium().subscribe({
      next: user => {
        this.session.updateUser(user);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Inschakelen is niet gelukt.');
        this.isLoading.set(false);
      }
    });
  }

  protected disable(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.api.disablePremium().subscribe({
      next: user => {
        this.session.updateUser(user);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Uitschakelen is niet gelukt.');
        this.isLoading.set(false);
      }
    });
  }
}
