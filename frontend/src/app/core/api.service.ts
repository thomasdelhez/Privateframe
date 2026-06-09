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

export interface MessageResponse {
  message: string;
}
