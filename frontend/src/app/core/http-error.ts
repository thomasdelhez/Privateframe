import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.detail === 'string') {
    return error.error.detail;
  }
  return fallback;
}
