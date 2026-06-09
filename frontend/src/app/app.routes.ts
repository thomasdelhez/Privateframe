import { Routes } from '@angular/router';
import { HomePageComponent } from './features/home-page.component';
import { LoginPageComponent } from './features/login-page.component';
import { AgePageComponent } from './features/age-page.component';
import { DiscoverPageComponent } from './features/discover-page.component';
import { ProfilePageComponent } from './features/profile-page.component';
import { ProfileDetailPageComponent } from './features/profile-detail-page.component';
import { PlanPageComponent } from './features/upgrade-page.component';
import { ChatPageComponent } from './features/chat-page.component';
import { AdminPageComponent } from './features/admin-page.component';
import { ForgotPasswordPageComponent } from './features/forgot-password-page.component';
import { ResetPasswordPageComponent } from './features/reset-password-page.component';
import { VerifyEmailPageComponent } from './features/verify-email-page.component';
import { adminGuard, ageGuard, authGuard, premiumGuard, verifiedGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'verify-email', component: VerifyEmailPageComponent },
  { path: 'forgot-password', component: ForgotPasswordPageComponent },
  { path: 'reset-password', component: ResetPasswordPageComponent },
  { path: 'age', component: AgePageComponent, canActivate: [authGuard, verifiedGuard] },
  { path: 'discover', component: DiscoverPageComponent, canActivate: [authGuard, verifiedGuard, ageGuard] },
  { path: 'discover/:slug', component: ProfileDetailPageComponent, canActivate: [authGuard, verifiedGuard, ageGuard] },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard, verifiedGuard] },
  { path: 'posts', redirectTo: 'profile', pathMatch: 'full' },
  { path: 'chat', component: ChatPageComponent, canActivate: [authGuard, verifiedGuard, ageGuard, premiumGuard] },
  { path: 'plan', component: PlanPageComponent, canActivate: [authGuard, verifiedGuard] },
  { path: 'admin', component: AdminPageComponent, canActivate: [authGuard, verifiedGuard, adminGuard] },
  { path: '**', redirectTo: '' }
];
