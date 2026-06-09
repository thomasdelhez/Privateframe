import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ChatPresenceService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  private pollHandle: number | null = null;

  public readonly unreadCount = signal(0);

  public constructor() {
    effect(() => {
      const shouldPoll = this.session.isLoggedIn() && this.session.isPremium();
      if (!shouldPoll) {
        this.stopPolling();
        this.unreadCount.set(0);
        return;
      }

      this.refreshUnreadCount();
      this.startPolling();
    });

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  public refreshUnreadCount(): void {
    if (!this.session.isLoggedIn() || !this.session.isPremium()) {
      this.unreadCount.set(0);
      return;
    }

    this.api.getConversations().subscribe({
      next: conversations => {
        const unread = conversations.reduce((sum, item) => sum + (item.unread_count || 0), 0);
        this.unreadCount.set(unread);
      },
      error: () => undefined
    });
  }

  private startPolling(): void {
    if (this.pollHandle !== null) {
      return;
    }

    this.pollHandle = window.setInterval(() => this.refreshUnreadCount(), 5000);
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}
