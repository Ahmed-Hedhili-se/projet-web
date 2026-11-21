import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateRentalRequest } from '../models/rental';
import { ChangePasswordRequest, UpdateProfileRequest } from '../models/user';
import { allMockGpus } from './mock-gpus';
import {
  EMAIL_PATTERN,
  FieldError,
  fail,
  respond,
  validationError,
  withAccount,
} from './mock-http';
import {
  allMockRentals,
  availableUnits,
  createRecord,
  rentalStatus,
  saveMockRentals,
  toApiRental,
} from './mock-rentals';
import { allMockAccounts, updateMockAccount } from './mock-users';

const HOUR_MS = 60 * 60 * 1000;

export function handleAccountRoutes(
  req: HttpRequest<unknown>,
  path: string,
): Observable<HttpResponse<unknown>> | null {
  if (req.method === 'GET' && path === '/rentals/me') {
    return withAccount(req, (account) => {
      // GET /rentals/me : les plus récentes d'abord
      const status = req.params.get('status');
      const rentals = allMockRentals()
        .filter((rental) => rental.userId === account.user.id)
        .filter((rental) => !status || rentalStatus(rental) === status)
        .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))
        .map(toApiRental);
      return respond({ rentals, total: rentals.length });
    });
  }

  if (req.method === 'POST' && path === '/rentals') {
    return withAccount(req, (account) =>
      createRental(req as HttpRequest<CreateRentalRequest>, account.user.id),
    );
  }

  const cancelMatch = path.match(/^\/rentals\/(\d+)\/cancel$/);
  if (req.method === 'PATCH' && cancelMatch) {
    return withAccount(req, (account) => {
      // PATCH /rentals/:id/cancel
      const rentals = allMockRentals();
      const record = rentals.find(
        (rental) => rental.id === Number(cancelMatch[1]) && rental.userId === account.user.id,
      );
      if (!record) {
        return fail(req, 404, {
          error: { code: 'RENTAL_NOT_FOUND', message: 'Rental not found.' },
        });
      }
      if (rentalStatus(record) !== 'UPCOMING') {
        return fail(req, 409, {
          error: {
            code: 'RENTAL_NOT_CANCELLABLE',
            message: 'Only upcoming rentals can be cancelled.',
          },
        });
      }
      record.cancelled = true;
      record.cancelledAt = new Date().toISOString();
      saveMockRentals(rentals);
      return respond({ rental: toApiRental(record) });
    });
  }

  if (req.method === 'GET' && path === '/users/me') {
    return withAccount(req, (account) => respond({ user: { ...account.user } })); // GET /users/me
  }

  if (req.method === 'PUT' && path === '/users/me') {
    return withAccount(req, (account) =>
      updateProfile(req as HttpRequest<UpdateProfileRequest>, account.user.id),
    );
  }

  if (req.method === 'PUT' && path === '/users/me/password') {
    return withAccount(req, (account) => {
      // PUT /users/me/password
      const body = (req as HttpRequest<ChangePasswordRequest>).body;
      const newPassword = body?.newPassword ?? '';
      if (newPassword.length < 8 || newPassword.length > 72) {
        return validationError(req, [
          { field: 'newPassword', message: 'Password must be between 8 and 72 characters.' },
        ]);
      }
      if (body?.currentPassword !== account.password) {
        return fail(req, 400, {
          error: { code: 'WRONG_PASSWORD', message: 'Your current password is incorrect.' },
        });
      }
      updateMockAccount(account.user.id, { password: newPassword });
      return respond({ success: true }, 600);
    });
  }

  return null;
}

function createRental(
  req: HttpRequest<CreateRentalRequest>,
  userId: number,
): Observable<HttpResponse<unknown>> {
  const body = req.body;
  const start = new Date(body?.startDate ?? '');
  const details: FieldError[] = [];
  if (!Number.isInteger(body?.gpuId)) {
    details.push({ field: 'gpuId', message: 'Choose a GPU.' });
  }
  if (!Number.isInteger(body?.quantity) || (body?.quantity ?? 0) < 1) {
    details.push({ field: 'quantity', message: 'Quantity must be at least 1.' });
  }
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000) {
    // une minute de tolérance
    details.push({ field: 'startDate', message: 'The start date must be in the future.' });
  }
  if (
    !Number.isInteger(body?.durationHours) ||
    (body?.durationHours ?? 0) < 1 ||
    (body?.durationHours ?? 0) > 720
  ) {
    details.push({ field: 'durationHours', message: 'Duration must be between 1 and 720 hours.' });
  }
  if (!body || details.length > 0) {
    return validationError(req, details);
  }

  const gpu = allMockGpus().find((item) => item.id === body.gpuId);
  if (!gpu) {
    return fail(req, 404, { error: { code: 'GPU_NOT_FOUND', message: 'GPU not found.' } });
  }
  if (!gpu.isActive) {
    return fail(req, 409, {
      error: { code: 'GPU_INACTIVE', message: 'This GPU is no longer available for rent.' },
    });
  }
  if (body.quantity > gpu.totalUnits) {
    return validationError(req, [
      { field: 'quantity', message: `This GPU has only ${gpu.totalUnits} units.` },
    ]);
  }
  const end = new Date(start.getTime() + body.durationHours * HOUR_MS);
  const free = availableUnits(gpu, start, end);
  if (body.quantity > free) {
    return fail(req, 409, {
      error: {
        code: 'NOT_ENOUGH_UNITS',
        message: `Only ${free} unit${free === 1 ? '' : 's'} available for this period.`,
      },
    });
  }
  const record = createRecord(userId, gpu, body.quantity, start, body.durationHours);
  return respond({ rental: toApiRental(record) }, 800, 201); // 201 = location créée
}

function updateProfile(
  req: HttpRequest<UpdateProfileRequest>,
  userId: number,
): Observable<HttpResponse<unknown>> {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const firstName = (req.body?.firstName ?? '').trim();
  const lastName = (req.body?.lastName ?? '').trim();
  const details: FieldError[] = [];
  if (!EMAIL_PATTERN.test(email)) {
    details.push({ field: 'email', message: 'Invalid email address.' });
  }
  if (firstName.length < 1 || firstName.length > 50) {
    details.push({ field: 'firstName', message: 'Enter your first name (50 characters max).' });
  }
  if (lastName.length < 1 || lastName.length > 50) {
    details.push({ field: 'lastName', message: 'Enter your last name (50 characters max).' });
  }
  if (details.length > 0) {
    return validationError(req, details);
  }
  if (
    allMockAccounts().some((account) => account.user.email === email && account.user.id !== userId)
  ) {
    return fail(req, 409, {
      error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
    });
  }
  const account = updateMockAccount(userId, { user: { email, firstName, lastName } });
  return respond({ user: { ...account!.user } }, 600);
}
