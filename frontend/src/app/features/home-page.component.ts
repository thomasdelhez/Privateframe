import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">PrivateFrame</p>
        <h1>Een besloten foto- en chatplatform dat rustiger, veiliger en chiquer aanvoelt.</h1>
        <p class="lead">
          Ontdek profielen, deel je eigen foto's, chat realtime en houd moderatie strak in de hand zonder dat de site
          goedkoop of rommelig oogt.
        </p>
        <div class="actions-row hero-actions">
          @if (session.isLoggedIn()) {
            <a routerLink="/discover">Profielen ontdekken</a>
            <a routerLink="/profile" class="secondary-link">Mijn profiel</a>
          } @else {
            <a routerLink="/login">Start nu</a>
            <a routerLink="/discover" class="secondary-link">Eerst rondkijken</a>
          }
        </div>
      </div>

      <div class="hero-card card">
        <div class="hero-stat-grid">
          <article>
            <strong>Realtime chat</strong>
            <p>Nieuwe berichten verschijnen direct, inclusief unread badge in de navigatie.</p>
          </article>
          <article>
            <strong>Fotoprofielen</strong>
            <p>Publieke profielpagina's met duidelijke galerijen in plaats van onhandige item-lijsten.</p>
          </article>
          <article>
            <strong>Moderatieflow</strong>
            <p>Meldingen, restricties, bans en post-acties met context in de adminomgeving.</p>
          </article>
          <article>
            <strong>Donker thema</strong>
            <p>Gebouwd voor mobiel gebruik, met een zwarte basis die beter past bij het merk.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section-grid">
      <article class="card feature-card">
        <p class="eyebrow">Voor leden</p>
        <h2>Profielen die als echte profielpagina's voelen</h2>
        <p>
          De discover- en profielpagina's zijn gericht op foto's, bio, locatie en snelle doorklik naar chat. Daarmee
          voelt het product meteen veel dichter bij het echte gebruik.
        </p>
      </article>

      <article class="card feature-card">
        <p class="eyebrow">Voor beheerders</p>
        <h2>Moderatie met context in plaats van losse UUID's</h2>
        <p>
          Op de adminpagina zie je nu leesbare gebruikers, profielen, posts en gesprekscontext. Dat maakt ingrijpen
          sneller en veel minder foutgevoelig.
        </p>
      </article>
    </section>

    <section class="card roadmap">
      <div>
        <p class="eyebrow">Wat er nu staat</p>
        <h2>De basis van het platform is er al</h2>
      </div>

      <div class="roadmap-grid">
        <article>
          <span class="step">01</span>
          <h3>Account en onboarding</h3>
          <p>Login, registratie, e-mailflow en toegangsstappen zijn aanwezig.</p>
        </article>
        <article>
          <span class="step">02</span>
          <h3>Profielen en foto's</h3>
          <p>Gebruikers kunnen hun profiel vullen en foto's publiceren op een publieke pagina.</p>
        </article>
        <article>
          <span class="step">03</span>
          <h3>Realtime chat</h3>
          <p>Gesprekken, unread meldingen, blokkeren, deblokkeren en reports werken samen.</p>
        </article>
        <article>
          <span class="step">04</span>
          <h3>Admin en moderatie</h3>
          <p>Reports, users, posts en audit staan klaar voor operationeel beheer.</p>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, .9fr); gap: 1.25rem; align-items: stretch; margin-bottom: 1.25rem; }
    .hero-copy, .hero-card { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.6rem; background: linear-gradient(140deg, rgba(15, 23, 42, .96), rgba(9, 9, 11, .96) 60%, rgba(30, 41, 59, .95)); color: #f8fafc; box-shadow: 0 24px 60px rgba(0, 0, 0, .28); }
    .hero-copy { display: grid; gap: 1rem; padding: 2rem; }
    .lead { margin: 0; max-width: 54rem; font-size: 1.05rem; line-height: 1.7; color: #cbd5e1; }
    .hero-actions { align-items: stretch; }
    .hero-card { padding: 1.4rem; }
    .hero-stat-grid { display: grid; gap: .9rem; height: 100%; }
    .hero-stat-grid article { display: grid; gap: .35rem; padding: 1rem; border-radius: 1rem; background: rgba(2, 6, 23, .52); border: 1px solid rgba(148, 163, 184, .12); }
    .hero-stat-grid p, .feature-card p, .roadmap p { margin: 0; color: #cbd5e1; line-height: 1.6; }
    .section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .feature-card { display: grid; gap: .65rem; min-height: 100%; }
    .roadmap { display: grid; gap: 1.2rem; }
    .roadmap-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .roadmap-grid article { display: grid; gap: .5rem; padding: 1rem; border-radius: 1rem; background: rgba(15, 23, 42, .48); border: 1px solid rgba(148, 163, 184, .12); }
    .step { display: inline-flex; width: fit-content; border-radius: 999px; padding: .2rem .55rem; background: rgba(244, 114, 182, .16); color: #f9a8d4; font-size: .8rem; font-weight: 800; letter-spacing: .08em; }
    @media (max-width: 980px) {
      .hero, .section-grid, .roadmap-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .hero-copy, .hero-card { padding: 1.15rem; border-radius: 1.2rem; }
    }
  `]
})
export class HomePageComponent {
  protected readonly session = inject(SessionService);
}
