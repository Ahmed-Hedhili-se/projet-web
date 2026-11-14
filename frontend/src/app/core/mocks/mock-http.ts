import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';
import { ApiError } from '../models/api-error';
import { MockAccount, allMockAccounts, mockTokenFor } from './mock-users';

export const NETWORK_DELAY_MS = 400;

export type FieldError = { field: string; message: string };

export function respond<T>(body: T, delayMs = NETWORK_DELAY_MS, status = 200): Observable<HttpResponse<T>> {
  return of(new HttpResponse({ status, body })).pipe(delay(delayMs));
}

export function fail(req: HttpRequest<unknown>, status: number, body: ApiError): Observable<never> {
  return timer(NETWORK_DELAY_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status, error: body, url: req.url }))),
  );
}

export function validationError(req: HttpRequest<unknown>, details: FieldError[]): Observable<never> {
  return fail(req, 400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request data.', details } });
}

export function withAccount(
  req: HttpRequest<unknown>,
  handler: (account: MockAccount) => Observable<HttpResponse<unknown>>,
): Observable<HttpResponse<unknown>> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const account = allMockAccounts().find((item) => mockTokenFor(item.user) === token);
  if (!account) {
    return fail(req, 401, { error: { code: 'UNAUTHORIZED', message: 'Please sign in again.' } });
  }
  if (account.user.isBlocked) {
    return fail(req, 403, { error: { code: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked. Please contact our support team.' } });
  }
  return handler(account);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
