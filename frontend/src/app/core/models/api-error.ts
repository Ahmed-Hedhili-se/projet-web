import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const apiError = err.error as ApiError | null;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    if (err.status === 0) {
      return 'Unable to reach the server. Please check your connection.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export function getErrorDetails(err: unknown): { field: string; message: string }[] {
  if (err instanceof HttpErrorResponse) {
    return (err.error as ApiError | null)?.error?.details ?? [];
  }
  return [];
}

export function getErrorCode(err: unknown): string | null {
  if (err instanceof HttpErrorResponse) {
    return (err.error as ApiError | null)?.error?.code ?? null;
  }
  return null;
}
