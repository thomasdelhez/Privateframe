import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero card">
      <p class="eyebrow">MVP</p>
      <h1>PrivateFrame</h1>
      <p class="lead">Een eerste werkende basis met login, onboarding, profielbeheer, overzicht, kaartjes en accountplan.</p>
      <div class="actions">
        @if (session.isLoggedIn()) {
          <a routerLink="/discover">Naar overzicht</a>
          <a routerLink="/profile" class="secondary-link">Profiel beheren</a>
        } @else {
          <a routerLink="/login">Starten</a>
        }
      </div>
    </section>

    <section class="grid">
      <article class="card step">
        <h2>1. Account</h2>
        <p>Registreer of log in met een testaccount.</p>
      </article>
      <article class="card step">
        <h2>2. Onboarding</h2>
        <p>Doorloop de bevestigingsstap voor toegang tot de MVP-flow.</p>
      </article>
      <article class="card step">
        <h2>3. Profiel</h2>
        <p>Maak een basisprofiel dat zichtbaar wordt in het overzicht.</p>
      </article>
      <article class="card step">
        <h2>4. Kaartjes</h2>
        <p>Maak testkaartjes aan en controleer de eenvoudige plan-flow.</p>
      </article>
    </section>
  `,
  styles: [`
    .hero { display: grid; gap: 1rem; margin-bottom: 1.5rem; }
    .eyebrow { color: #f472b6; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .lead { font-size: 1.15rem; color: #d1d5db; max-width: 760px; }
    .actions { display: flex; gap: .75rem; flex-wrap: wrap; }
    a { display: inline-flex; align-items: center; justify-content: center; border-radius: .75rem; padding: .75rem 1rem; background: #f472b6; color: #111827; font-weight: 800; text-decoration: none; }
    .secondary-link { background: rgba(255,255,255,.08); color: #f9fafb; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .step { min-height: 150px; }
  `]
})
export class HomePageComponent {
  protected readonly session = inject(SessionService);
}
