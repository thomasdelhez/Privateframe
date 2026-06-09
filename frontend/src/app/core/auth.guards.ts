import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const verifiedGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isEmailVerified() ? true : router.createUrlTree(['/verify-email']);
};

export const ageGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.user()?.age_confirmed ? true : router.createUrlTree(['/age']);
};

export const premiumGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isPremium() ? true : router.createUrlTree(['/plan']);
};

export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isAdmin() ? true : router.createUrlTree(['/discover']);
};
