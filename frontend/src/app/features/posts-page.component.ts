import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Post } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card flow">
      <div class="title-row">
        <div>
          <p class="eyebrow">Items</p>
          <h1>Kaartjes beheren</h1>
          <p>Maak testkaartjes aan en voeg een voorbeeldregel toe om de MVP-flow te controleren.</p>
        </div>
        <button type="button" class="secondary" (click)="load()" [disabled]="isLoading()">Verversen</button>
      </div>

      @if (!session.isLoggedIn()) {
        <p>Log eerst in om items te beheren.</p>
        <a routerLink="/login">Naar login</a>
      } @else {
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        @if (success()) {
          <p class="success">{{ success() }}</p>
        }

        <form class="form" (ngSubmit)="create()">
          <h2>Nieuw kaartje</h2>
          <label>
            Titel
            <input name="title" [(ngModel)]="title" maxlength="120" required />
          </label>
          <label>
            Beschrijving
            <textarea name="description" [(ngModel)]="description" maxlength="1200" rows="4"></textarea>
          </label>

          <div class="checks">
            <label><input type="checkbox" name="ruleAge" [(ngModel)]="ruleAge" /> Regel 1 akkoord</label>
            <label><input type="checkbox" name="ruleRights" [(ngModel)]="ruleRights" /> Regel 2 akkoord</label>
            <label><input type="checkbox" name="ruleSafe" [(ngModel)]="ruleSafe" /> Regel 3 akkoord</label>
            <label><input type="checkbox" name="rulePermission" [(ngModel)]="rulePermission" /> Regel 4 akkoord</label>
          </div>

          <button type="submit" [disabled]="isSaving() || !canCreate()">
            {{ isSaving() ? 'Aanmaken...' : 'Kaartje aanmaken' }}
          </button>
        </form>

        <div class="list">
          <h2>Bestaande kaartjes</h2>
          @if (isLoading()) {
            <p>Kaartjes laden...</p>
          } @else if (items().length === 0) {
            <p class="muted">Nog geen kaartjes.</p>
          } @else {
            @for (item of items(); track item.id) {
              <article class="item">
                <div>
                  <h3>{{ item.title }}</h3>
                  @if (item.description) { <p>{{ item.description }}</p> }
                  <p class="muted">{{ item.status }} · {{ item.assets.length }} regel(s)</p>
                </div>
                <div class="actions">
                  <button type="button" class="secondary" (click)="addExample(item.id)">Voorbeeldregel toevoegen</button>
                </div>
                @if (item.assets.length > 0) {
                  <div class="assets">
                    @for (asset of item.assets; track asset.id) {
                      <span class="pill">{{ asset.locked ? 'beperkt' : 'open' }}</span>
                    }
                  </div>
                }
              </article>
            }
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .flow { display: grid; gap: 1.25rem; }
    .title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .eyebrow { color: #f472b6; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .form, .list { display: grid; gap: 1rem; border: 1px solid rgba(255,255,255,.12); border-radius: 1rem; padding: 1rem; background: rgba(255,255,255,.04); }
    label { display: grid; gap: .35rem; color: #d1d5db; }
    input[type='text'], input:not([type]), textarea { width: 100%; border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; background: rgba(15,23,42,.9); color: #f9fafb; padding: .8rem; }
    textarea { resize: vertical; }
    .checks { display: grid; gap: .5rem; }
    .checks label { display: flex; align-items: center; gap: .5rem; }
    .item { display: grid; gap: .75rem; padding: 1rem; border: 1px solid rgba(255,255,255,.1); border-radius: .9rem; }
    .actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .assets { display: flex; gap: .5rem; flex-wrap: wrap; }
    .pill { border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: .25rem .6rem; color: #d1d5db; }
    .muted { color: #9ca3af; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
  `]
})
export class PostsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly items = signal<Post[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected title = '';
  protected description = '';
  protected ruleAge = true;
  protected ruleRights = true;
  protected ruleSafe = true;
  protected rulePermission = true;

  public ngOnInit(): void {
    if (this.session.isLoggedIn()) {
      this.load();
    }
  }

  protected canCreate(): boolean {
    return !!this.title.trim() && this.ruleAge && this.ruleRights && this.ruleSafe && this.rulePermission;
  }

  protected load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.api.getPosts().subscribe({
      next: items => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Kaartjes laden is niet gelukt.');
        this.isLoading.set(false);
      }
    });
  }

  protected create(): void {
    this.isSaving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.createPost({
      title: this.title.trim(),
      description: this.description.trim() || null,
      rule_age: this.ruleAge,
      rule_rights: this.ruleRights,
      rule_safe: this.ruleSafe,
      rule_permission: this.rulePermission
    }).subscribe({
      next: item => {
        this.items.set([item, ...this.items()]);
        this.title = '';
        this.description = '';
        this.success.set('Kaartje aangemaakt.');
        this.isSaving.set(false);
      },
      error: () => {
        this.error.set('Kaartje aanmaken is niet gelukt. Controleer of alle regels zijn aangevinkt.');
        this.isSaving.set(false);
      }
    });
  }

  protected addExample(itemId: string): void {
    this.error.set(null);
    this.success.set(null);
    this.api.addPlaceholderAsset(itemId).subscribe({
      next: updated => {
        this.items.set(this.items().map(item => item.id === updated.id ? updated : item));
        this.success.set('Voorbeeldregel toegevoegd.');
      },
      error: () => this.error.set('Voorbeeldregel toevoegen is niet gelukt.')
    });
  }
}
