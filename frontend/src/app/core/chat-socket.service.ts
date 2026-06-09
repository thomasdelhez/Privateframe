import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatMessage, Conversation } from './api.service';
import { SessionService } from './session.service';

export type ChatSocketEvent =
  | { type: 'connected' }
  | { type: 'pong' }
  | { type: 'unread_summary'; unread_count: number }
  | { type: 'conversation_updated'; conversation: Conversation }
  | { type: 'message_created'; message: ChatMessage }
  | { type: 'messages_read'; conversation_id: string; read_by: string; read_at: string; message_ids: string[] };

@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsSubject = new Subject<ChatSocketEvent>();
  private socket: WebSocket | null = null;
  private reconnectHandle: number | null = null;
  private pingHandle: number | null = null;

  public readonly events$: Observable<ChatSocketEvent> = this.eventsSubject.asObservable();
  public readonly unreadCount = signal(0);
  public readonly isConnected = signal(false);

  public constructor() {
    effect(() => {
      const token = this.session.value;
      const shouldConnect = this.session.isLoggedIn() && this.session.isPremium() && !!token;
      if (!shouldConnect) {
        this.disconnect();
        this.unreadCount.set(0);
        return;
      }

      this.ensureConnected();
    });

    this.destroyRef.onDestroy(() => this.disconnect());
  }

  public setUnreadCount(value: number): void {
    this.unreadCount.set(value);
  }

  public ensureConnected(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const token = this.session.value;
    if (!token) {
      return;
    }

    const socket = new WebSocket(this.buildSocketUrl(token));
    this.socket = socket;

    socket.onopen = () => {
      this.isConnected.set(true);
      this.eventsSubject.next({ type: 'connected' });
      this.startPing();
    };

    socket.onmessage = event => {
      const payload = JSON.parse(event.data) as ChatSocketEvent;
      if (payload.type === 'unread_summary') {
        this.unreadCount.set(payload.unread_count);
      }
      this.eventsSubject.next(payload);
    };

    socket.onclose = () => {
      this.isConnected.set(false);
      this.stopPing();
      this.socket = null;
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      this.isConnected.set(false);
    };
  }

  public disconnect(): void {
    this.clearReconnect();
    this.stopPing();
    this.isConnected.set(false);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private buildSocketUrl(token: string): string {
    const base = new URL(environment.apiBaseUrl, window.location.origin);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/chat/ws`;
    base.searchParams.set('token', token);
    return base.toString();
  }

  private scheduleReconnect(): void {
    if (this.reconnectHandle !== null || !this.session.isLoggedIn() || !this.session.isPremium()) {
      return;
    }

    this.reconnectHandle = window.setTimeout(() => {
      this.reconnectHandle = null;
      this.ensureConnected();
    }, 3000);
  }

  private clearReconnect(): void {
    if (this.reconnectHandle !== null) {
      window.clearTimeout(this.reconnectHandle);
      this.reconnectHandle = null;
    }
  }

  private startPing(): void {
    if (this.pingHandle !== null) {
      return;
    }

    this.pingHandle = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  private stopPing(): void {
    if (this.pingHandle !== null) {
      window.clearInterval(this.pingHandle);
      this.pingHandle = null;
    }
  }
}
