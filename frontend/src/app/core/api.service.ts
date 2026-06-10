import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CurrentUser, SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  public register(email: string, password: string): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.baseUrl}/auth/register`, { email, password });
  }

  public login(email: string, password: string): Observable<{ access_value: string; user: CurrentUser }> {
    return this.http.post<{ access_value: string; user: CurrentUser }>(`${this.baseUrl}/auth/login`, { email, password });
  }

  public getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/auth/me`, { headers: this.headers() });
  }

  public logout(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/logout`, {}, { headers: this.headers() });
  }

  public verifyEmail(token: string): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.baseUrl}/auth/email/verify`, { token });
  }

  public resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/email/resend`, { email });
  }

  public forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/password/forgot`, { email });
  }

  public resetPassword(token: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/password/reset`, { token, password });
  }

  public confirmAge(): Observable<{ age_confirmed: boolean }> {
    return this.http.post<{ age_confirmed: boolean }>(`${this.baseUrl}/auth/age/confirm`, {}, { headers: this.headers() });
  }

  public getProfiles(filters?: { q?: string; location?: string; limit?: number }): Observable<Profile[]> {
    const params = new URLSearchParams();
    if (filters?.q) {
      params.set('q', filters.q);
    }
    if (filters?.location) {
      params.set('location', filters.location);
    }
    if (filters?.limit) {
      params.set('limit', String(filters.limit));
    }

    const query = params.toString();
    const url = query ? `${this.baseUrl}/profiles?${query}` : `${this.baseUrl}/profiles`;
    return this.http.get<Profile[]>(url, { headers: this.headers() });
  }

  public getMyProfile(): Observable<Profile> {
    return this.http.get<Profile>(`${this.baseUrl}/profiles/me`, { headers: this.headers() });
  }

  public getProfile(slug: string): Observable<Profile> {
    return this.http.get<Profile>(`${this.baseUrl}/profiles/${slug}`, { headers: this.headers() });
  }

  public saveMyProfile(payload: ProfileSave): Observable<Profile> {
    return this.http.put<Profile>(`${this.baseUrl}/profiles/me`, payload, { headers: this.headers() });
  }

  public getMyProfileActivity(): Observable<ProfileVisitSummary> {
    return this.http.get<ProfileVisitSummary>(`${this.baseUrl}/profiles/me/activity`, { headers: this.headers() });
  }

  public getPosts(filters?: { userId?: string }): Observable<Post[]> {
    const params = new URLSearchParams();
    if (filters?.userId) {
      params.set('user_id', filters.userId);
    }
    const query = params.toString();
    const url = query ? `${this.baseUrl}/posts?${query}` : `${this.baseUrl}/posts`;
    return this.http.get<Post[]>(url, { headers: this.headers() });
  }

  public createPost(payload: PostCreate): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/posts`, payload, { headers: this.headers() });
  }

  public uploadPostAsset(postId: string, file: File): Observable<PostAssetUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<PostAssetUploadResponse>(`${this.baseUrl}/posts/${postId}/assets`, formData, {
      headers: this.headers()
    });
  }

  public getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.baseUrl}/chat`, { headers: this.headers() });
  }

  public createConversation(otherUserId: string): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.baseUrl}/chat`, { other_user_id: otherUserId }, { headers: this.headers() });
  }

  public getConversationMessages(conversationId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/chat/${conversationId}/messages`, { headers: this.headers() });
  }

  public sendConversationMessage(conversationId: string, body: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/chat/${conversationId}/messages`, { body }, { headers: this.headers() });
  }

  public markConversationRead(conversationId: string): Observable<{ conversation_id: string; read_count: number }> {
    return this.http.post<{ conversation_id: string; read_count: number }>(`${this.baseUrl}/chat/${conversationId}/read`, {}, { headers: this.headers() });
  }

  public blockConversation(conversationId: string): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.baseUrl}/chat/${conversationId}/block`, {}, { headers: this.headers() });
  }

  public unblockConversation(conversationId: string): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.baseUrl}/chat/${conversationId}/unblock`, {}, { headers: this.headers() });
  }

  public createReport(payload: ReportCreate): Observable<ReportItem> {
    return this.http.post<ReportItem>(`${this.baseUrl}/reports`, payload, { headers: this.headers() });
  }

  public getMyReports(): Observable<ReportItem[]> {
    return this.http.get<ReportItem[]>(`${this.baseUrl}/reports/my`, { headers: this.headers() });
  }

  public getAdminReports(): Observable<ReportItem[]> {
    return this.http.get<ReportItem[]>(`${this.baseUrl}/reports/admin`, { headers: this.headers() });
  }

  public resolveReport(reportId: string): Observable<ReportItem> {
    return this.http.post<ReportItem>(`${this.baseUrl}/reports/admin/${reportId}/resolve`, {}, { headers: this.headers() });
  }

  public getAdminUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/admin/users`, { headers: this.headers() });
  }

  public restrictUser(userId: string): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(`${this.baseUrl}/admin/users/${userId}/restrict`, {}, { headers: this.headers() });
  }

  public banUser(userId: string): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(`${this.baseUrl}/admin/users/${userId}/ban`, {}, { headers: this.headers() });
  }

  public getAdminPosts(): Observable<AdminPost[]> {
    return this.http.get<AdminPost[]>(`${this.baseUrl}/admin/posts`, { headers: this.headers() });
  }

  public getAdminPost(postId: string): Observable<AdminPost> {
    return this.http.get<AdminPost>(`${this.baseUrl}/admin/posts/${postId}`, { headers: this.headers() });
  }

  public hidePost(postId: string): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(`${this.baseUrl}/admin/posts/${postId}/hide`, {}, { headers: this.headers() });
  }

  public removePost(postId: string): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(`${this.baseUrl}/admin/posts/${postId}/remove`, {}, { headers: this.headers() });
  }

  public getAuditLog(): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>(`${this.baseUrl}/admin/audit`, { headers: this.headers() });
  }

  public getAdminReportContext(reportId: string): Observable<AdminReportContext> {
    return this.http.get<AdminReportContext>(`${this.baseUrl}/admin/reports/${reportId}/context`, { headers: this.headers() });
  }

  public getPlanStatus(): Observable<{ status: string; role: string }> {
    return this.http.get<{ status: string; role: string }>(`${this.baseUrl}/plan/status`, { headers: this.headers() });
  }

  public enablePremium(): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.baseUrl}/plan/enable`, {}, { headers: this.headers() });
  }

  public disablePremium(): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.baseUrl}/plan/disable`, {}, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    const value = this.session.value;
    return value ? new HttpHeaders({ Authorization: `Bearer ${value}` }) : new HttpHeaders();
  }
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  location_label: string | null;
  gender: string | null;
  age_label: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileSave {
  display_name: string;
  bio?: string | null;
  location_label?: string | null;
  gender?: string | null;
  age_label?: string | null;
}

export interface ProfileVisit {
  id: string;
  visited_at: string;
  profile: Profile | null;
}

export interface ProfileVisitSummary {
  count: number;
  visits: ProfileVisit[];
}

export interface PostCreate {
  title: string;
  description?: string | null;
  rule_age: boolean;
  rule_rights: boolean;
  rule_safe: boolean;
  rule_permission: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  assets: { id: string; locked: boolean; preview_url?: string | null; url?: string | null }[];
}

export interface PostAssetUploadResponse {
  post: Post;
  asset: { id: string; locked: boolean; preview_url?: string | null; url?: string | null };
}

export interface Conversation {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: 'active' | 'blocked' | 'reported';
  created_at: string;
  updated_at: string;
  unread_count: number;
  last_message: ChatMessage | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  status: 'sent' | 'read' | 'removed';
  created_at: string;
  read_at?: string | null;
}

export type ReportTargetType = 'profile' | 'post' | 'conversation' | 'message';
export type ReportReason = 'fake_account' | 'no_consent' | 'underage' | 'prohibited' | 'spam_or_scam' | 'harassment' | 'copyright' | 'other';

export interface ReportCreate {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  description?: string | null;
}

export interface ReportItem {
  id: string;
  reporter_user_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  description: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  subscription_status: string;
  created_at: string;
  profile_slug: string | null;
  display_name: string | null;
}

export interface AdminPost {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  removed_at?: string | null;
  profile_slug: string | null;
  display_name: string | null;
  assets?: { id: string; locked: boolean; preview_url?: string | null; url?: string | null; mime_type?: string; file_size?: number }[];
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
  created_at: string;
  actor?: AdminUser | null;
  entity_label?: string | null;
  entity_route?: string | null;
}

export interface AdminReportContext {
  report: ReportItem;
  reporter?: AdminUser | null;
  profile?: Profile | null;
  post?: AdminPost | null;
  conversation?: {
    id: string;
    status: string;
    user_a_id: string;
    user_b_id: string;
    created_at: string;
    updated_at: string;
    participants: AdminUser[];
  } | null;
  reported_message_id?: string | null;
  message_count?: number;
  messages?: ChatMessage[];
}

export interface MessageResponse {
  message: string;
}
