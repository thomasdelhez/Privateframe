import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, ChatMessage, Conversation, Profile, ReportItem, ReportReason } from '../core/api.service';
import { ChatPresenceService } from '../core/chat-presence.service';
import { ChatSocketEvent, ChatSocketService } from '../core/chat-socket.service';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card flow" [class.conversation-open]="selectedConversation()">
      <div class="hero">
        <div>
          <p class="eyebrow">Berichten</p>
          <h1>Chat met je matches</h1>
          <p>Start gesprekken vanaf een profiel, stuur berichten en blokkeer of meld een gesprek als dat nodig is.</p>
        </div>
        <div class="hero-actions">
          <a routerLink="/discover" class="secondary-link">Nieuwe profielen bekijken</a>
          <button type="button" class="secondary" (click)="openReportsModal()">
            Mijn meldingen
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (success()) {
        <p class="success">{{ success() }}</p>
      }

      <div class="layout">
        <aside class="panel sidebar">
          <div class="panel-head">
            <div>
              <h2>Gesprekken</h2>
              <p class="muted">{{ conversations().length }} actief of geblokkeerd.</p>
            </div>
          </div>

          @if (isLoadingConversations()) {
            <p>Gesprekken laden...</p>
          } @else if (conversations().length === 0) {
            <div class="empty">
              <p>Je hebt nog geen gesprekken. Open een profiel en klik op chat starten.</p>
            </div>
          } @else {
            <div class="conversation-list">
              @for (conversation of conversations(); track conversation.id) {
                <button
                  type="button"
                  class="conversation-item"
                  [class.active]="selectedConversationId() === conversation.id"
                  (click)="selectConversation(conversation.id)">
                  <div class="conversation-copy">
                    <span class="conversation-avatar">{{ participantInitials(conversation) }}</span>
                    <div>
                    <strong>{{ participantName(conversation) }}</strong>
                    <p class="muted">{{ participantHandle(conversation) }}</p>
                    </div>
                  </div>
                  <div class="conversation-state">
                    @if (conversation.unread_count > 0) {
                      <span class="unread-badge">{{ conversation.unread_count }}</span>
                    }
                    <span class="pill" [class.warn]="conversation.status !== 'active'">{{ statusLabel(conversation.status) }}</span>
                  </div>
                </button>
              }
            </div>
          }
        </aside>

        <section class="panel thread">
          @if (!selectedConversation()) {
            <div class="empty thread-empty">
              <h2>Kies een gesprek</h2>
              <p>Je berichten verschijnen hier zodra je een gesprek opent.</p>
            </div>
          } @else if (selectedConversation(); as conversation) {
            <div class="thread-head">
              <div class="thread-identity">
                <button type="button" class="mobile-back secondary" (click)="selectConversation(null)" aria-label="Terug naar gesprekken">
                  <span aria-hidden="true">←</span>
                  <span>Gesprekken</span>
                </button>
                <div>
                  <h2>{{ participantName(conversation) }}</h2>
                  <p class="muted">
                    {{ participantHandle(conversation) }} · {{ statusLabel(conversation.status) }}
                  </p>
                </div>
              </div>
              <div class="thread-actions">
                @if (conversation.status === 'active') {
                  <button type="button" class="secondary" (click)="blockSelectedConversation()" [disabled]="isBlockingConversation()">
                    {{ isBlockingConversation() ? 'Blokkeren...' : 'Blokkeren' }}
                  </button>
                } @else if (conversation.status === 'blocked') {
                  <button type="button" class="secondary" (click)="unblockSelectedConversation()" [disabled]="isUnblockingConversation()">
                    {{ isUnblockingConversation() ? 'Deblokkeren...' : 'Deblokkeren' }}
                  </button>
                }
                <button type="button" class="secondary" (click)="toggleReportComposer()">
                  {{ isReportComposerOpen() ? 'Annuleren' : 'Melden' }}
                </button>
              </div>
            </div>

            @if (isReportComposerOpen()) {
              <form class="report-box" (ngSubmit)="submitConversationReport()">
                <label>
                  Reden
                  <select name="reportReason" [(ngModel)]="reportReason">
                    @for (option of reportReasons; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </label>

                <label>
                  Toelichting
                  <textarea
                    name="reportDescription"
                    [(ngModel)]="reportDescription"
                    rows="3"
                    maxlength="600"
                    placeholder="Geef kort context mee voor de moderation flow."></textarea>
                </label>

                <button type="submit" [disabled]="isSubmittingReport()">
                  {{ isSubmittingReport() ? 'Verzenden...' : 'Gesprek melden' }}
                </button>
              </form>
            }

            <div class="thread-body">
              @if (isLoadingMessages()) {
                <p>Berichten laden...</p>
              } @else {
                <div class="messages" #messagesViewport>
                  @if (messages().length === 0) {
                    <p class="muted">Nog geen berichten in dit gesprek.</p>
                  } @else {
                    @for (message of messages(); track message.id) {
                      <article class="message" [class.own]="message.sender_id === currentUserId()">
                        <div class="message-meta">
                          <strong>{{ message.sender_id === currentUserId() ? 'Jij' : participantName(conversation) }}</strong>
                          <span>{{ formatDate(message.created_at) }}</span>
                        </div>
                        <p>{{ message.body }}</p>
                      </article>
                    }
                  }
                </div>
              }
            </div>

            <form class="composer" (ngSubmit)="sendMessage()">
              <label class="sr-only" for="chat-message">Bericht</label>
              <textarea
                id="chat-message"
                name="messageBody"
                [(ngModel)]="messageBody"
                rows="1"
                maxlength="2000"
                placeholder="Typ je bericht..."
                (keydown)="onComposerKeydown($event)"
                [disabled]="conversation.status !== 'active' || isSendingMessage()"></textarea>
              <button type="submit" [disabled]="conversation.status !== 'active' || isSendingMessage() || !messageBody.trim()">
                <span class="desktop-send-label">{{ isSendingMessage() ? 'Versturen...' : 'Verstuur bericht' }}</span>
                <span class="mobile-send-label">{{ isSendingMessage() ? 'Bezig...' : 'Verstuur' }}</span>
              </button>
            </form>
          }
        </section>
      </div>
    </section>

    @if (isReportsModalOpen()) {
      <div class="modal-backdrop" (click)="closeReportsModal()">
        <section class="modal panel" (click)="$event.stopPropagation()">
          <div class="panel-head">
            <div>
              <h2>Mijn meldingen</h2>
              <p class="muted">Hier zie je wat je al hebt gemeld en wat de huidige status is.</p>
            </div>
            <button type="button" class="secondary" (click)="closeReportsModal()">Sluiten</button>
          </div>

          @if (isLoadingReports()) {
            <p>Meldingen laden...</p>
          } @else if (myReports().length === 0) {
            <p class="muted">Je hebt nog geen meldingen gedaan.</p>
          } @else {
            <div class="report-list">
              @for (report of myReports(); track report.id) {
                <article class="report-item">
                  <div class="report-row">
                    <strong>{{ reportLabel(report) }}</strong>
                    <span class="pill" [class.good]="report.status === 'resolved'">{{ report.status }}</span>
                  </div>
                  <p class="muted">{{ formatDate(report.created_at) }}</p>
                  @if (report.description) {
                    <p>{{ report.description }}</p>
                  }
                </article>
              }
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    .flow { display: grid; gap: 1rem; }
    .hero { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1.5rem; border-radius: 1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, .98), rgba(30, 41, 59, .92) 55%, rgba(9, 9, 11, .94)); border: 1px solid rgba(148, 163, 184, .14); color: #f8fafc; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .secondary-link { display: inline-flex; align-items: center; padding: .78rem 1rem; border-radius: 999px; border: 1px solid rgba(148, 163, 184, .2); background: rgba(15, 23, 42, .85); color: #e2e8f0; text-decoration: none; font-weight: 700; }
    .secondary-link:hover { border-color: rgba(251, 191, 36, .45); color: #f8fafc; }
    .eyebrow { margin: 0 0 .25rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .layout { display: grid; grid-template-columns: minmax(260px, 300px) minmax(0, 1fr); gap: 1rem; align-items: start; }
    .panel { border: 1px solid rgba(148, 163, 184, .14); border-radius: 1.25rem; padding: 1.1rem; background: linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .96)); color: #f8fafc; box-shadow: 0 16px 36px rgba(0, 0, 0, .24); }
    .panel-head, .thread-head, .report-row { display: flex; justify-content: space-between; gap: .75rem; align-items: flex-start; }
    .conversation-list, .report-list { display: grid; gap: .75rem; margin-top: 1rem; }
    .conversation-item { display: flex; justify-content: space-between; gap: .75rem; align-items: center; text-align: left; padding: .95rem; border-radius: 1rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .82); color: #f8fafc; }
    .conversation-copy { display: flex; align-items: center; gap: .7rem; min-width: 0; }
    .conversation-copy > div { min-width: 0; }
    .conversation-copy strong, .conversation-copy p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .conversation-copy p { margin: .18rem 0 0; }
    .conversation-avatar { display: grid; place-items: center; flex: 0 0 auto; width: 2.6rem; height: 2.6rem; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #ec4899 52%, #38bdf8); color: white; font-size: .82rem; font-weight: 900; }
    .conversation-state { display: grid; justify-items: end; gap: .35rem; flex: 0 0 auto; }
    .unread-badge { display: grid; place-items: center; min-width: 1.35rem; height: 1.35rem; padding: 0 .35rem; border-radius: 999px; background: #ec4899; color: white; font-size: .72rem; font-weight: 900; }
    .conversation-item.active { border-color: rgba(251, 191, 36, .35); background: rgba(30, 41, 59, .92); }
    .conversation-item:hover { border-color: rgba(251, 191, 36, .25); }
    .muted { color: #94a3b8; }
    .pill { border-radius: 999px; background: rgba(148, 163, 184, .12); border: 1px solid rgba(148, 163, 184, .14); color: #e2e8f0; padding: .28rem .65rem; font-size: .82rem; font-weight: 700; }
    .pill.warn { color: #fcd34d; border-color: rgba(251, 191, 36, .25); }
    .pill.good { color: #86efac; border-color: rgba(34, 197, 94, .22); }
    .thread { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "header" "report" "messages" "composer"; gap: 1rem; min-height: 0; height: min(78vh, 920px); max-height: 920px; overflow: hidden; }
    .thread-head { grid-area: header; }
    .thread-identity { display: flex; align-items: center; gap: .75rem; min-width: 0; }
    .thread-identity h2, .thread-identity p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mobile-back { display: none; }
    .thread-body { grid-area: messages; min-height: 0; overflow: hidden; }
    .messages { display: grid; align-content: start; gap: .75rem; min-height: 0; height: 100%; overflow-y: auto; padding-right: .2rem; overscroll-behavior-y: contain; scrollbar-gutter: stable; -webkit-overflow-scrolling: touch; }
    .message { display: grid; gap: .45rem; max-width: 80%; padding: .85rem 1rem; border-radius: 1rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .92); }
    .message.own { margin-left: auto; background: linear-gradient(135deg, rgba(91, 33, 182, .28), rgba(15, 23, 42, .96)); border-color: rgba(192, 132, 252, .28); }
    .message-meta { display: flex; justify-content: space-between; gap: .75rem; color: #cbd5e1; font-size: .9rem; }
    .message p, .report-item p { margin: 0; }
    .composer, .report-box { display: grid; gap: .75rem; }
    .composer { grid-area: composer; grid-template-columns: minmax(0, 1fr) auto; align-items: end; margin-top: auto; padding-top: .85rem; border-top: 1px solid rgba(148, 163, 184, .14); background: rgba(2, 6, 23, .96); }
    .composer textarea { min-height: 3.2rem; max-height: 7.5rem; resize: none; }
    .composer button { width: auto; min-height: 3.2rem; }
    .mobile-send-label { display: none; }
    textarea, select { width: 100%; border: 1px solid rgba(148, 163, 184, .2); border-radius: .85rem; background: rgba(15, 23, 42, .95); color: #f8fafc; padding: .85rem .95rem; }
    .thread-actions { display: flex; flex-wrap: wrap; gap: .75rem; }
    .report-box { grid-area: report; margin: 0; padding: 1rem; border-radius: 1rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .7); }
    .report-item { display: grid; gap: .35rem; padding-top: .75rem; border-top: 1px solid rgba(148, 163, 184, .14); }
    .report-item:first-child { padding-top: 0; border-top: 0; }
    .modal-backdrop { position: fixed; inset: 0; display: grid; place-items: center; padding: 1.5rem; background: rgba(2, 6, 23, .78); backdrop-filter: blur(8px); z-index: 120; }
    .modal { width: min(720px, 100%); max-height: min(80vh, 900px); overflow: auto; }
    .empty { border: 1px dashed rgba(148, 163, 184, .22); border-radius: 1rem; padding: 1rem; background: rgba(15, 23, 42, .45); }
    .thread-empty { grid-area: 1 / 1 / -1 / -1; min-height: 420px; place-content: center; }
    .error { color: #fecaca; background: rgba(127, 29, 29, .45); padding: .75rem; border-radius: .5rem; }
    .success { color: #bbf7d0; background: rgba(20, 83, 45, .45); padding: .75rem; border-radius: .5rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .conversation-open { height: calc(100dvh - 8.5rem - env(safe-area-inset-bottom)); min-height: 0; overflow: hidden; }
    .conversation-open > .hero,
    .conversation-open > .error,
    .conversation-open > .success { display: none; }
    .conversation-open .layout { height: 100%; min-height: 0; align-items: stretch; }
    .conversation-open .sidebar { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; overflow: hidden; }
    .conversation-open .conversation-list { min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; }
    .conversation-open .thread { height: 100%; max-height: none; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 280px minmax(0, 1fr); }
    }
    @media (max-width: 820px) {
      .hero, .layout, .thread-head, .panel-head, .report-row { display: grid; }
      .layout { grid-template-columns: minmax(0, 1fr); }
      .hero { padding: 1.1rem; border-radius: 1.15rem; }
      .hero-actions, .thread-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
      .sidebar { padding: .85rem; }
      .sidebar .panel-head { display: flex; }
      .conversation-list { grid-auto-flow: column; grid-auto-columns: minmax(210px, 78vw); overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: inline mandatory; padding: 0 .1rem .55rem; margin-top: .75rem; scrollbar-width: thin; }
      .conversation-item { width: 100%; min-height: 74px; scroll-snap-align: start; padding: .75rem; }
      .conversation-state .pill { display: none; }
      .thread-empty { min-height: auto; }
      .message { max-width: 100%; }
      .thread { height: auto; min-height: min(620px, calc(100dvh - 8rem)); max-height: none; padding: .9rem; }
      .messages { padding-right: .1rem; }
      .composer { padding-bottom: env(safe-area-inset-bottom); }
      .modal-backdrop { align-items: end; padding: .6rem; }
      .modal { width: 100%; max-height: 88dvh; border-radius: 1.25rem 1.25rem .75rem .75rem; padding-bottom: max(1rem, env(safe-area-inset-bottom)); }

      .conversation-open {
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
      }
      .conversation-open .sidebar { display: none; }
      .conversation-open .thread {
        min-height: 0;
        border-radius: 1rem;
      }
      .conversation-open .thread-head { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
      .conversation-open .thread-identity { min-width: 0; }
      .conversation-open .mobile-back { display: inline-flex; flex: 0 0 auto; width: auto; min-height: 2.6rem; padding: .65rem .8rem; gap: .35rem; }
      .conversation-open .thread-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: auto; }
      .conversation-open .thread-actions button { width: auto; min-height: 2.6rem; padding: .65rem .8rem; }
      .conversation-open .thread-body { min-height: 0; overflow: hidden; }
    }
    @media (max-width: 480px) {
      .hero-actions, .thread-actions { grid-template-columns: 1fr; }
      .thread-head { gap: .65rem; }
      .message { padding: .72rem .8rem; }
      .message-meta { display: grid; gap: .15rem; }
      .composer button { width: auto; min-height: 3.2rem; padding-inline: 1rem; }
      .desktop-send-label { display: none; }
      .mobile-send-label { display: inline; }
      .report-box { padding: .8rem; }
      .conversation-open .thread { gap: .75rem; padding: .75rem; }
      .conversation-open .thread-head { grid-template-columns: minmax(0, 1fr); }
      .conversation-open .thread-identity { display: grid; grid-template-columns: auto minmax(0, 1fr); }
      .conversation-open .mobile-back span:last-child { display: none; }
      .conversation-open .mobile-back { min-width: 2.6rem; padding-inline: .65rem; }
      .conversation-open .thread-actions { width: 100%; }
    }
    @media (max-width: 560px) {
      .conversation-open { height: calc(100dvh - 7.75rem - env(safe-area-inset-bottom)); }
    }
  `]
})
export class ChatPageComponent implements OnInit, OnDestroy {
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLDivElement>;

  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly chatPresence = inject(ChatPresenceService);
  private readonly chatSocket = inject(ChatSocketService);
  protected readonly session = inject(SessionService);
  private socketSubscription?: Subscription;

  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly profiles = signal<Profile[]>([]);
  protected readonly myReports = signal<ReportItem[]>([]);
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly isLoadingConversations = signal(false);
  protected readonly isLoadingMessages = signal(false);
  protected readonly isLoadingReports = signal(false);
  protected readonly isSendingMessage = signal(false);
  protected readonly isBlockingConversation = signal(false);
  protected readonly isUnblockingConversation = signal(false);
  protected readonly isSubmittingReport = signal(false);
  protected readonly isReportComposerOpen = signal(false);
  protected readonly isReportsModalOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly selectedConversation = computed(() =>
    this.conversations().find(item => item.id === this.selectedConversationId()) ?? null
  );

  protected messageBody = '';
  protected reportReason: ReportReason = 'harassment';
  protected reportDescription = '';

  protected readonly reportReasons = [
    { value: 'harassment', label: 'Intimidatie of grensoverschrijdend gedrag' },
    { value: 'spam_or_scam', label: 'Spam of scam' },
    { value: 'no_consent', label: 'Geen toestemming' },
    { value: 'fake_account', label: 'Fake account' },
    { value: 'prohibited', label: 'Verboden inhoud' },
    { value: 'underage', label: 'Minderjarig' },
    { value: 'copyright', label: 'Auteursrecht' },
    { value: 'other', label: 'Anders' }
  ] as const;

  public ngOnInit(): void {
    this.loadProfiles();
    this.loadReports();
    this.loadConversations();
    this.chatSocket.ensureConnected();
    this.socketSubscription = this.chatSocket.events$.subscribe(event => this.handleSocketEvent(event));
  }

  public ngOnDestroy(): void {
    this.socketSubscription?.unsubscribe();
  }

  private loadProfiles(): void {
    this.api.getProfiles({ limit: 100 }).subscribe({
      next: profiles => this.profiles.set(profiles),
      error: () => this.profiles.set([])
    });
  }

  private loadConversations(silent = false): void {
    if (!silent) {
      this.isLoadingConversations.set(true);
    }
    this.error.set(null);
    this.api.getConversations().subscribe({
      next: conversations => {
        const sorted = [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        this.conversations.set(sorted);
        if (!silent) {
          this.isLoadingConversations.set(false);
        }
        this.chatPresence.refreshUnreadCount();

        const requestedId = this.route.snapshot.queryParamMap.get('conversation');
        const nextId = requestedId && sorted.some(item => item.id === requestedId)
          ? requestedId
          : this.selectedConversationId() && sorted.some(item => item.id === this.selectedConversationId())
            ? this.selectedConversationId()
            : sorted[0]?.id ?? null;

        if (nextId !== this.selectedConversationId()) {
          this.selectConversation(nextId);
        }
      },
      error: () => {
        this.error.set('Gesprekken laden is niet gelukt.');
        if (!silent) {
          this.isLoadingConversations.set(false);
        }
      }
    });
  }

  private loadReports(): void {
    this.isLoadingReports.set(true);
    this.api.getMyReports().subscribe({
      next: reports => {
        this.myReports.set(reports);
        this.isLoadingReports.set(false);
      },
      error: () => {
        this.myReports.set([]);
        this.isLoadingReports.set(false);
      }
    });
  }

  protected selectConversation(conversationId: string | null): void {
    this.selectedConversationId.set(conversationId);
    this.messageBody = '';
    this.isReportComposerOpen.set(false);
    this.reportDescription = '';
    if (!conversationId) {
      this.messages.set([]);
      return;
    }

    this.isLoadingMessages.set(true);
    this.api.getConversationMessages(conversationId).subscribe({
      next: messages => {
        this.messages.set(messages);
        this.isLoadingMessages.set(false);
        this.markSelectedConversationRead();
        this.scheduleMessagesScroll();
      },
      error: () => {
        this.messages.set([]);
        this.error.set('Berichten laden is niet gelukt.');
        this.isLoadingMessages.set(false);
      }
    });
  }

  protected sendMessage(): void {
    const conversationId = this.selectedConversationId();
    if (!conversationId || !this.messageBody.trim()) {
      return;
    }

    this.isSendingMessage.set(true);
    this.error.set(null);
    this.api.sendConversationMessage(conversationId, this.messageBody.trim()).subscribe({
      next: message => {
        this.messages.update(items => [...items, message]);
        this.messageBody = '';
        this.isSendingMessage.set(false);
        this.touchConversation(conversationId);
        this.chatPresence.refreshUnreadCount();
        this.scheduleMessagesScroll();
      },
      error: () => {
        this.error.set('Versturen van je bericht is niet gelukt.');
        this.isSendingMessage.set(false);
      }
    });
  }

  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!this.messageBody.trim() || this.isSendingMessage() || this.selectedConversation()?.status !== 'active') {
      return;
    }
    this.sendMessage();
  }

  protected blockSelectedConversation(): void {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return;
    }

    this.isBlockingConversation.set(true);
    this.api.blockConversation(conversation.id).subscribe({
      next: updated => {
        this.replaceConversation(updated);
        this.success.set('Gesprek is geblokkeerd.');
        this.isBlockingConversation.set(false);
        this.chatPresence.refreshUnreadCount();
      },
      error: () => {
        this.error.set('Blokkeren is niet gelukt.');
        this.isBlockingConversation.set(false);
      }
    });
  }

  protected unblockSelectedConversation(): void {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return;
    }

    this.isUnblockingConversation.set(true);
    this.api.unblockConversation(conversation.id).subscribe({
      next: updated => {
        this.replaceConversation(updated);
        this.success.set('Gesprek is gedeblokkeerd.');
        this.isUnblockingConversation.set(false);
        this.chatPresence.refreshUnreadCount();
      },
      error: () => {
        this.error.set('Deblokkeren is niet gelukt.');
        this.isUnblockingConversation.set(false);
      }
    });
  }

  protected toggleReportComposer(): void {
    this.isReportComposerOpen.update(value => !value);
    this.success.set(null);
    this.error.set(null);
  }

  protected openReportsModal(): void {
    this.isReportsModalOpen.set(true);
    if (!this.isLoadingReports()) {
      this.loadReports();
    }
  }

  protected closeReportsModal(): void {
    this.isReportsModalOpen.set(false);
  }

  protected submitConversationReport(): void {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return;
    }

    this.isSubmittingReport.set(true);
    this.api.createReport({
      target_type: 'conversation',
      target_id: conversation.id,
      reason: this.reportReason,
      description: this.reportDescription.trim() || null
    }).subscribe({
      next: report => {
        this.myReports.update(items => [report, ...items]);
        this.reportDescription = '';
        this.isReportComposerOpen.set(false);
        this.success.set('Melding verstuurd naar de moderation inbox.');
        this.isSubmittingReport.set(false);
      },
      error: () => {
        this.error.set('Melding versturen is niet gelukt.');
        this.isSubmittingReport.set(false);
      }
    });
  }

  protected participantName(conversation: Conversation): string {
    const profile = this.findParticipantProfile(conversation);
    return profile?.display_name || 'Onbekend profiel';
  }

  protected participantHandle(conversation: Conversation): string {
    const profile = this.findParticipantProfile(conversation);
    return profile ? `/${profile.slug}` : this.otherUserId(conversation).slice(0, 8);
  }

  protected participantInitials(conversation: Conversation): string {
    return this.participantName(conversation)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  }

  protected statusLabel(status: Conversation['status']): string {
    if (status === 'blocked') {
      return 'geblokkeerd';
    }
    if (status === 'reported') {
      return 'gemeld';
    }
    return 'actief';
  }

  protected reportLabel(report: ReportItem): string {
    return `${report.target_type} · ${report.reason.replaceAll('_', ' ')}`;
  }

  protected currentUserId(): string {
    return this.session.user()?.id ?? '';
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  private otherUserId(conversation: Conversation): string {
    return conversation.user_a_id === this.currentUserId() ? conversation.user_b_id : conversation.user_a_id;
  }

  private findParticipantProfile(conversation: Conversation): Profile | undefined {
    return this.profiles().find(profile => profile.user_id === this.otherUserId(conversation));
  }

  private replaceConversation(updated: Conversation): void {
    this.conversations.update(items =>
      items.map(item => item.id === updated.id ? updated : item)
    );
  }

  private touchConversation(conversationId: string): void {
    this.conversations.update(items => {
      const updated = items.map(item =>
        item.id === conversationId
          ? {
              ...item,
              updated_at: new Date().toISOString(),
              last_message: this.messages().at(-1) ?? item.last_message
            }
          : item
      );
      return [...updated].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });
  }

  private markSelectedConversationRead(): void {
    const conversationId = this.selectedConversationId();
    if (!conversationId) {
      return;
    }

    this.api.markConversationRead(conversationId).subscribe({
      next: result => {
        if (result.read_count > 0) {
          this.messages.update(items =>
            items.map(item =>
              item.sender_id !== this.currentUserId() && !item.read_at
                ? { ...item, status: 'read', read_at: new Date().toISOString() }
                : item
            )
          );
        }
        this.conversations.update(items =>
          items.map(item =>
            item.id === conversationId ? { ...item, unread_count: 0 } : item
          )
        );
        this.chatPresence.refreshUnreadCount();
      },
      error: () => undefined
    });
  }

  private handleSocketEvent(event: ChatSocketEvent): void {
    if (event.type === 'conversation_updated') {
      this.upsertConversation(event.conversation);
      return;
    }

    if (event.type === 'message_created') {
      this.appendMessageIfMissing(event.message);
      if (event.message.conversation_id === this.selectedConversationId() && event.message.sender_id !== this.currentUserId()) {
        this.markSelectedConversationRead();
      }
      return;
    }

    if (event.type === 'messages_read') {
      if (event.conversation_id !== this.selectedConversationId()) {
        return;
      }
      this.messages.update(items =>
        items.map(item =>
          event.message_ids.includes(item.id)
            ? { ...item, status: 'read', read_at: event.read_at }
            : item
        )
      );
    }
  }

  private upsertConversation(conversation: Conversation): void {
    this.conversations.update(items => {
      const withoutCurrent = items.filter(item => item.id !== conversation.id);
      return [conversation, ...withoutCurrent].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }

  private appendMessageIfMissing(message: ChatMessage): void {
    if (message.conversation_id !== this.selectedConversationId()) {
      return;
    }

    const shouldScroll = this.isMessagesViewportNearBottom();
    this.messages.update(items => {
      if (items.some(item => item.id === message.id)) {
        return items;
      }
      return [...items, message];
    });
    if (shouldScroll) {
      this.scheduleMessagesScroll();
    }
  }

  private isMessagesViewportNearBottom(): boolean {
    const viewport = this.messagesViewport?.nativeElement;
    if (!viewport) {
      return true;
    }
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
  }

  private scheduleMessagesScroll(): void {
    requestAnimationFrame(() => {
      const viewport = this.messagesViewport?.nativeElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }
}
