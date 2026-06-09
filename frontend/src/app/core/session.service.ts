import { Injectable, signal } from '@angular/core';

export interface CurrentUser {
  id: string;
  email: string;
  role: 'free' | 'premium' | 'moderator' | 'admin';
  subscription_status: string;
  status: string;
  age_confirmed: boolean;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly key = 'privateframe_session';
  private readonly userKey = 'privateframe_user';

  public readonly user = signal<CurrentUser | null>(this.readUser());

  public get value(): string | null {
    return localStorage.getItem(this.key);
  }

  public isLoggedIn(): boolean {
    return !!this.value;
  }

  public isPremium(): boolean {
    const user = this.user();
    return !!user && ['premium', 'moderator', 'admin'].includes(user.role);
  }

  public set(value: string, user: CurrentUser): void {
    localStorage.setItem(this.key, value);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.user.set(user);
  }

  public updateUser(user: CurrentUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.user.set(user);
  }

  public clear(): void {
    localStorage.removeItem(this.key);
    localStorage.removeItem(this.userKey);
    this.user.set(null);
    window.location.href = '/';
  }

  private readUser(): CurrentUser | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) as CurrentUser : null;
  }
}
