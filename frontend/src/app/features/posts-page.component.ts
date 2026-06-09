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
          <h1>Media-items beheren</h1>
          <p>Maak een kaartje aan en upload daarna echte beelden in plaats van demo-assets.</p>
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
                <div class="item-head">
                  <div>
                    <h3>{{ item.title }}</h3>
                    @if (item.description) { <p>{{ item.description }}</p> }
                    <p class="muted">{{ item.status }} · {{ item.assets.length }} bestand(en)</p>
                  </div>

                  @if (isOwner(item)) {
                    <label class="upload-label">
                      <span>{{ isUploadingFor(item.id) ? 'Uploaden...' : 'Bestand kiezen' }}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        [disabled]="isUploadingFor(item.id)"
                        (change)="uploadFile(item.id, $event)"
                      />
                    </label>
                  }
                </div>

                @if (item.assets.length > 0) {
                  <div class="assets">
                    @for (asset of item.assets; track asset.id) {
                      <figure class="asset-card">
                        @if (asset.preview_url) {
                          <img [src]="asset.preview_url" alt="Preview van upload" />
                        }
                        <figcaption>
                          <span class="pill">{{ asset.locked ? 'preview' : 'volledig zichtbaar' }}</span>
                        </figcaption>
                      </figure>
                    }
                  </div>
                } @else {
                  <p class="muted">Nog geen media geüpload.</p>
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
    .eyebrow { color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .form, .list { display: grid; gap: 1rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: 1rem; padding: 1rem; background: rgba(10, 15, 27, .74); }
    label { display: grid; gap: .35rem; color: #cbd5e1; }
    input[type='text'], input:not([type]), textarea { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .75rem; background: rgba(15,23,42,.95); color: #f8fafc; padding: .8rem; }
    textarea { resize: vertical; }
    .checks { display: grid; gap: .5rem; }
    .checks label { display: flex; align-items: center; gap: .5rem; }
    .item { display: grid; gap: .9rem; padding: 1rem; border: 1px solid rgba(148, 163, 184, .14); border-radius: .9rem; background: rgba(2, 6, 23, .42); }
    .item-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .upload-label { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; padding: .8rem 1rem; border-radius: 999px; border: 1px solid rgba(148, 163, 184, .24); background: #0f172a; color: #f8fafc; cursor: pointer; font-weight: 700; }
    .upload-label input { display: none; }
    .assets { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; }
    .asset-card { margin: 0; display: grid; gap: .65rem; }
    .asset-card img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: .9rem; border: 1px solid rgba(148, 163, 184, .16); background: #020617; }
    .pill { display: inline-flex; border: 1px solid rgba(148, 163, 184, .2); border-radius: 999px; padding: .25rem .6rem; color: #cbd5e1; font-size: .92rem; }
    .muted { color: #94a3b8; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    @media (max-width: 720px) {
      .item-head { display: grid; }
    }
  `]
})
export class PostsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  protected readonly items = signal<Post[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly uploadingPostId = signal<string | null>(null);
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

  protected isOwner(item: Post): boolean {
    return this.session.user()?.id === item.user_id;
  }

  protected isUploadingFor(postId: string): boolean {
    return this.uploadingPostId() === postId;
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

  protected uploadFile(postId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploadingPostId.set(postId);
    this.error.set(null);
    this.success.set(null);

    this.api.uploadPostAsset(postId, file).subscribe({
      next: ({ post }) => {
        this.items.set(this.items().map(item => item.id === post.id ? post : item));
        this.success.set('Bestand geüpload.');
        this.uploadingPostId.set(null);
        input.value = '';
      },
      error: () => {
        this.error.set('Uploaden is niet gelukt. Gebruik JPG, PNG, WebP of GIF tot 10 MB.');
        this.uploadingPostId.set(null);
        input.value = '';
      }
    });
  }
}
