import { Routes } from '@angular/router';
import { HomePageComponent } from './features/home-page.component';
import { LoginPageComponent } from './features/login-page.component';
import { AgePageComponent } from './features/age-page.component';
import { DiscoverPageComponent } from './features/discover-page.component';
import { ProfilePageComponent } from './features/profile-page.component';
import { PostsPageComponent } from './features/posts-page.component';
import { PlanPageComponent } from './features/plan-page.component';
import { ChatPageComponent } from './features/chat-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'age', component: AgePageComponent },
  { path: 'discover', component: DiscoverPageComponent },
  { path: 'profile', component: ProfilePageComponent },
  { path: 'posts', component: PostsPageComponent },
  { path: 'plan', component: PlanPageComponent },
  { path: 'chat', component: ChatPageComponent },
  { path: '**', redirectTo: '' }
];
