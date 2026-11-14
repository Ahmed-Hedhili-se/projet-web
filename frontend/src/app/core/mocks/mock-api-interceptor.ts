import { HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContactRequest } from '../models/contact';
import { Gpu, GpuListResponse } from '../models/gpu';
import { RecommendationRequest } from '../models/recommendation';
import { LoginRequest, RegisterRequest, User } from '../models/user';
import { handleAccountRoutes } from './mock-account-routes';
import { handleAdminRoutes } from './mock-admin-routes';
import { handleAgentRoutes } from './mock-agent-routes';
import { allMockGpus } from './mock-gpus';
import { addMockMessage } from './mock-messages';
import { EMAIL_PATTERN, FieldError, fail, respond, validationError, withAccount } from './mock-http';
import { mockRecommend } from './mock-recommendation';
import { availableUnits } from './mock-rentals';
import { addMockAccount, allMockAccounts, mockTokenFor, nextMockUserId } from './mock-users';

const HOUR_MS = 60 * 60 * 1000;

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const path = req.url.slice(environment.apiUrl.length);

  if (req.method === 'POST' && path === '/recommendations') {
    return recommend(req as HttpRequest<RecommendationRequest>);
  }
  if (req.method === 'POST' && path === '/contact') {
    return contact(req as HttpRequest<ContactRequest>);
  }
  if (req.method === 'POST' && path === '/auth/login') {
    return login(req as HttpRequest<LoginRequest>);
  }
  if (req.method === 'POST' && path === '/auth/register') {
    return register(req as HttpRequest<RegisterRequest>);
  }
  if (req.method === 'GET' && path === '/auth/me') {
    return withAccount(req, (account) => respond({ user: { ...account.user } }));
  }

  const accountResponse = handleAccountRoutes(req, path);
  if (accountResponse) {
    return accountResponse;
  }

  const adminResponse = handleAdminRoutes(req, path);
  if (adminResponse) {
    return adminResponse;
  }

  const agentResponse = handleAgentRoutes(req, path);
  if (agentResponse) {
    return agentResponse;
  }

  if (req.method === 'GET' && path === '/gpus') {
    return respond(listGpus(req.params));
  }
  const match = path.match(/^\/gpus\/(\d+)$/);
  if (req.method === 'GET' && match) {
    const gpu = allMockGpus().find((item) => item.id === Number(match[1]) && item.isActive);
    if (!gpu) {
      return fail(req, 404, { error: { code: 'GPU_NOT_FOUND', message: 'GPU not found.' } });
    }
    return respond({ gpu: withAvailability(gpu, req.params) });
  }

  return next(req);
};

function withAvailability(gpu: Gpu, params: HttpParams): Gpu {
  const start = params.has('startDate') ? new Date(params.get('startDate')!) : new Date();
  const hours = params.has('durationHours') ? Number(params.get('durationHours')) : 1;
  const end = new Date(start.getTime() + hours * HOUR_MS);
  return { ...gpu, availableUnits: availableUnits(gpu, start, end) };
}

function listGpus(params: HttpParams): GpuListResponse {
  const active = allMockGpus().filter((gpu) => gpu.isActive);
  const search = params.get('search')?.toLowerCase() ?? '';
  const manufacturer = params.get('manufacturer');
  const minVram = params.has('minVram') ? Number(params.get('minVram')) : null;
  const maxPrice = params.has('maxPrice') ? Number(params.get('maxPrice')) : null;
  const availableOnly = params.get('available') === 'true';
  const sort = params.get('sort') ?? 'price_asc';

  const gpus = active
    .map((gpu) => withAvailability(gpu, params))
    .filter(
      (gpu) =>
        (!search || gpu.name.toLowerCase().includes(search) || gpu.architecture.toLowerCase().includes(search)) &&
        (!manufacturer || gpu.manufacturer === manufacturer) &&
        (minVram === null || gpu.vramGb >= minVram) &&
        (maxPrice === null || gpu.pricePerHour <= maxPrice) &&
        (!availableOnly || gpu.availableUnits >= 1),
    );

  gpus.sort((a, b) => {
    switch (sort) {
      case 'price_desc': return b.pricePerHour - a.pricePerHour;
      case 'vram_desc': return b.vramGb - a.vramGb;
      case 'name_asc': return a.name.localeCompare(b.name);
      default: return a.pricePerHour - b.pricePerHour;
    }
  });

  return {
    gpus,
    total: gpus.length,
    manufacturers: [...new Set(active.map((gpu) => gpu.manufacturer))].sort(),
  };
}

function recommend(req: HttpRequest<RecommendationRequest>): Observable<HttpResponse<unknown>> {
  const body = req.body;
  const details: FieldError[] = [];
  if (!body || !['LLM', 'VISION', 'DIFFUSION', 'AUDIO', 'OTHER'].includes(body.modelType)) {
    details.push({ field: 'modelType', message: 'Choose a model type.' });
  }
  if (!body || !(body.parametersBillions >= 0.01 && body.parametersBillions <= 2000)) {
    details.push({ field: 'parametersBillions', message: 'Enter a number between 0.01 and 2000.' });
  }
  if (!body || !['TRAINING', 'INFERENCE'].includes(body.mode)) {
    details.push({ field: 'mode', message: 'Choose training or inference.' });
  }
  if (!body || !(body.budgetPerHour > 0)) {
    details.push({ field: 'budgetPerHour', message: 'Enter a budget greater than 0.' });
  }
  if (!body || details.length > 0) {
    return validationError(req, details);
  }
  return respond(mockRecommend(body, allMockGpus()), 900);
}

const MAX_LOGIN_FAILURES = 5;
const loginFailures = new Map<string, number>();

function login(req: HttpRequest<LoginRequest>): Observable<HttpResponse<unknown>> {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const password = req.body?.password ?? '';
  const details: FieldError[] = [];
  if (!EMAIL_PATTERN.test(email)) {
    details.push({ field: 'email', message: 'Invalid email address.' });
  }
  if (password.length === 0) {
    details.push({ field: 'password', message: 'Enter your password.' });
  }
  if (details.length > 0) {
    return validationError(req, details);
  }

  if ((loginFailures.get(email) ?? 0) >= MAX_LOGIN_FAILURES) {
    return fail(req, 429, { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Please try again in 15 minutes.' } });
  }

  const account = allMockAccounts().find((item) => item.user.email === email);
  if (!account || account.password !== password) {
    loginFailures.set(email, (loginFailures.get(email) ?? 0) + 1);
    return fail(req, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }
  if (account.user.isBlocked) {
    return fail(req, 403, { error: { code: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked. Please contact our support team.' } });
  }

  loginFailures.delete(email);
  return respond({ token: mockTokenFor(account.user), user: { ...account.user } }, 700);
}

function register(req: HttpRequest<RegisterRequest>): Observable<HttpResponse<unknown>> {
  const body = req.body;
  const email = (body?.email ?? '').trim().toLowerCase();
  const firstName = (body?.firstName ?? '').trim();
  const lastName = (body?.lastName ?? '').trim();
  const password = body?.password ?? '';
  const details: FieldError[] = [];
  if (!EMAIL_PATTERN.test(email)) {
    details.push({ field: 'email', message: 'Invalid email address.' });
  }
  if (password.length < 8 || password.length > 72) {
    details.push({ field: 'password', message: 'Password must be between 8 and 72 characters.' });
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
  if (allMockAccounts().some((account) => account.user.email === email)) {
    return fail(req, 409, { error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' } });
  }

  const user: User = { id: nextMockUserId(), email, firstName, lastName, role: 'USER', isBlocked: false, createdAt: new Date().toISOString() };
  addMockAccount({ password, user });
  return respond({ token: mockTokenFor(user), user }, 800, 201);
}

function contact(req: HttpRequest<ContactRequest>): Observable<HttpResponse<unknown>> {
  const body = req.body;
  const details: FieldError[] = [];
  const length = (value: unknown) => (typeof value === 'string' ? value.trim().length : 0);
  if (length(body?.name) < 1 || length(body?.name) > 100) {
    details.push({ field: 'name', message: 'Enter your name (100 characters max).' });
  }
  if (!EMAIL_PATTERN.test(body?.email ?? '')) {
    details.push({ field: 'email', message: 'Invalid email address.' });
  }
  if (length(body?.subject) < 1 || length(body?.subject) > 150) {
    details.push({ field: 'subject', message: 'Enter a subject (150 characters max).' });
  }
  if (length(body?.message) < 10 || length(body?.message) > 2000) {
    details.push({ field: 'message', message: 'Your message must be between 10 and 2000 characters.' });
  }
  if (details.length > 0) {
    return validationError(req, details);
  }
  const saved = addMockMessage({
    name: body!.name.trim(),
    email: body!.email.trim(),
    subject: body!.subject.trim(),
    message: body!.message.trim(),
  });
  return respond({ success: true, id: saved.id }, 700, 201);
}
