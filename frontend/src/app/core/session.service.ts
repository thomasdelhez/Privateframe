import { Injectable, signal } from '@angular/core';

export interface CurrentUser {
  id: string;
  email: string;
  role: 'free' | 'premium' | 'moderator' | 'admin';
  subscription_status: string;
  status: string;
  email_verified: boolean;
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

  public isStaff(): boolean {
    const user = this.user();
    return !!user && ['moderator', 'admin'].includes(user.role);
  }

  public isAdmin(): boolean {
    return this.user()?.role === 'admin';
  }

  public isEmailVerified(): boolean {
    return this.user()?.email_verified === true;
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
  }

  private readUser(): CurrentUser | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as CurrentUser;
    } catch {
      localStorage.removeItem(this.userKey);
      return null;
    }
  }
}
