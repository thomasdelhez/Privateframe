import { Routes } from '@angular/router';
import { HomePageComponent } from './features/home-page.component';
import { LoginPageComponent } from './features/login-page.component';
import { AgePageComponent } from './features/age-page.component';
import { DiscoverPageComponent } from './features/discover-page.component';
import { ProfilePageComponent } from './features/profile-page.component';
import { PostsPageComponent } from './features/posts-page.component';
import { PlanPageComponent } from './features/upgrade-page.component';
import { ForgotPasswordPageComponent } from './features/forgot-password-page.component';
import { ResetPasswordPageComponent } from './features/reset-password-page.component';
import { VerifyEmailPageComponent } from './features/verify-email-page.component';
import { ageGuard, authGuard, verifiedGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'verify-email', component: VerifyEmailPageComponent },
  { path: 'forgot-password', component: ForgotPasswordPageComponent },
  { path: 'reset-password', component: ResetPasswordPageComponent },
  { path: 'age', component: AgePageComponent, canActivate: [authGuard, verifiedGuard] },
  { path: 'discover', component: DiscoverPageComponent, canActivate: [authGuard, verifiedGuard, ageGuard] },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard, verifiedGuard] },
  { path: 'posts', component: PostsPageComponent, canActivate: [authGuard, verifiedGuard, ageGuard] },
  { path: 'plan', component: PlanPageComponent, canActivate: [authGuard, verifiedGuard] },
  { path: '**', redirectTo: '' }
];
