import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CurrentUser, SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = 'http://localhost:8000/api/v1';

  public register(email: string, password: string): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.baseUrl}/auth/register`, { email, password });
  }

  public login(email: string, password: string): Observable<{ access_value: string; user: CurrentUser }> {
    return this.http.post<{ access_value: string; user: CurrentUser }>(`${this.baseUrl}/auth/login`, { email, password });
  }

  public confirmAge(): Observable<{ age_confirmed: boolean }> {
    return this.http.post<{ age_confirmed: boolean }>(`${this.baseUrl}/auth/age/confirm`, {}, { headers: this.headers() });
  }

  public getProfiles(): Observable<Profile[]> {
    return this.http.get<Profile[]>(`${this.baseUrl}/profiles`, { headers: this.headers() });
  }

  public saveMyProfile(payload: ProfileSave): Observable<Profile> {
    return this.http.put<Profile>(`${this.baseUrl}/profiles/me`, payload, { headers: this.headers() });
  }

  public getPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts`, { headers: this.headers() });
  }

  public createPost(payload: PostCreate): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/posts`, payload, { headers: this.headers() });
  }

  public enablePremium(): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.baseUrl}/plan/enable`, {}, { headers: this.headers() });
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
  created_at: string;
}

export interface ProfileSave {
  display_name: string;
  bio?: string | null;
  location_label?: string | null;
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
  assets: { id: string; locked: boolean }[];
}
