import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../models/api-error';
import { ContactRequest } from '../models/contact';
import { LoginRequest } from '../models/user';
import { MOCK_ACCOUNTS, mockTokenFor } from './mock-users';
import { GpuListResponse } from '../models/gpu';
import { RecommendationRequest } from '../models/recommendation';
import { MOCK_GPUS } from './mock-gpus';
import { mockRecommend } from './mock-recommendation';

const NETWORK_DELAY_MS = 400;                              // simule le temps de réponse d'un vrai serveur

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => { // répond à la place du backend (environment.useMockApi)
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);                                      // requête vers un autre site : on n'y touche pas
  }
  const path = req.url.slice(environment.apiUrl.length);   // ex. "/gpus", "/gpus/3", "/recommendations"

  if (req.method === 'POST' && path === '/recommendations') {
    return recommend(req as HttpRequest<RecommendationRequest>); // POST /recommendations
  }

  if (req.method === 'POST' && path === '/contact') {
    return contact(req as HttpRequest<ContactRequest>);    // POST /contact
  }

  if (req.method === 'POST' && path === '/auth/login') {
    return login(req as HttpRequest<LoginRequest>);        // POST /auth/login
  }

  if (req.method === 'GET' && path === '/auth/me') {
    return me(req);                                        // GET /auth/me
  }

  if (req.method !== 'GET' || !path.startsWith('/gpus')) {
    return next(req);                                      // route pas encore simulée : la requête part normalement
  }

  if (path === '/gpus') {
    return respond(listGpus(req.params));                  // GET /gpus
  }

  const match = path.match(/^\/gpus\/(\d+)$/);             // GET /gpus/:id
  const gpu = match ? MOCK_GPUS.find((item) => item.id === Number(match[1]) && item.isActive) : undefined;
  if (!gpu) {
    return fail(req, 404, { error: { code: 'GPU_NOT_FOUND', message: 'GPU not found.' } });
  }
  return respond({ gpu: { ...gpu } });
};

function listGpus(params: HttpParams): GpuListResponse {   // reproduit les filtres et le tri décrits dans docs/API.md
  const active = MOCK_GPUS.filter((gpu) => gpu.isActive);
  const search = params.get('search')?.toLowerCase() ?? '';
  const manufacturer = params.get('manufacturer');
  const minVram = params.has('minVram') ? Number(params.get('minVram')) : null;
  const maxPrice = params.has('maxPrice') ? Number(params.get('maxPrice')) : null;
  const availableOnly = params.get('available') === 'true';
  const sort = params.get('sort') ?? 'price_asc';

  const gpus = active.filter(
    (gpu) =>
      (!search || gpu.name.toLowerCase().includes(search) || gpu.architecture.toLowerCase().includes(search)) &&
      (!manufacturer || gpu.manufacturer === manufacturer) &&
      (minVram === null || gpu.vramGb >= minVram) &&
      (maxPrice === null || gpu.pricePerHour <= maxPrice) &&
      (!availableOnly || gpu.availableUnits >= 1),         // simplifié : la période n'est pas prise en compte ici
  );

  gpus.sort((a, b) => {
    switch (sort) {
      case 'price_desc': return b.pricePerHour - a.pricePerHour;
      case 'vram_desc': return b.vramGb - a.vramGb;
      case 'name_asc': return a.name.localeCompare(b.name);
      default: return a.pricePerHour - b.pricePerHour;     // price_asc (valeur par défaut)
    }
  });

  return {
    gpus: gpus.map((gpu) => ({ ...gpu })),                 // copies, pour ne jamais modifier les données fictives
    total: gpus.length,
    manufacturers: [...new Set(active.map((gpu) => gpu.manufacturer))].sort(),
  };
}

function recommend(req: HttpRequest<RecommendationRequest>): Observable<HttpResponse<unknown>> {
  const body = req.body;
  const details: { field: string; message: string }[] = []; // erreurs de validation, comme Zod côté backend
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
    return fail(req, 400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request data.', details } });
  }
  return respond(mockRecommend(body, MOCK_GPUS), 900);     // délai plus long : laisse voir l'animation d'analyse
}

const MAX_LOGIN_FAILURES = 5;                              // docs/API.md : 5 échecs max (le vrai backend utilise Redis, par IP + email, sur 15 min)
const loginFailures = new Map<string, number>();           // nombre d'échecs par email, en mémoire

function login(req: HttpRequest<LoginRequest>): Observable<HttpResponse<unknown>> {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const password = req.body?.password ?? '';
  const details: { field: string; message: string }[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.push({ field: 'email', message: 'Invalid email address.' });
  }
  if (password.length === 0) {
    details.push({ field: 'password', message: 'Enter your password.' });
  }
  if (details.length > 0) {
    return fail(req, 400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request data.', details } });
  }

  if ((loginFailures.get(email) ?? 0) >= MAX_LOGIN_FAILURES) {
    return fail(req, 429, { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Please try again in 15 minutes.' } });
  }

  const account = MOCK_ACCOUNTS.find((item) => item.user.email === email);
  if (!account || account.password !== password) {
    loginFailures.set(email, (loginFailures.get(email) ?? 0) + 1); // un échec de plus pour cet email
    return fail(req, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }
  if (account.user.isBlocked) {
    return fail(req, 403, { error: { code: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked. Please contact our support team.' } });
  }

  loginFailures.delete(email);                             // connexion réussie : le compteur repart à zéro
  return respond({ token: mockTokenFor(account.user), user: { ...account.user } }, 700);
}

function me(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');  // header ajouté par authInterceptor
  const account = MOCK_ACCOUNTS.find((item) => mockTokenFor(item.user) === token);
  if (!account) {
    return fail(req, 401, { error: { code: 'UNAUTHORIZED', message: 'Please sign in again.' } });
  }
  if (account.user.isBlocked) {
    return fail(req, 403, { error: { code: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked. Please contact our support team.' } });
  }
  return respond({ user: { ...account.user } });
}

let nextContactId = 13;                                    // les messages fictifs continuent après l'exemple n° 12 de docs/API.md

function contact(req: HttpRequest<ContactRequest>): Observable<HttpResponse<unknown>> {
  const body = req.body;
  const details: { field: string; message: string }[] = []; // mêmes règles que docs/API.md
  const length = (value: unknown) => (typeof value === 'string' ? value.trim().length : 0);
  if (length(body?.name) < 1 || length(body?.name) > 100) {
    details.push({ field: 'name', message: 'Enter your name (100 characters max).' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body?.email ?? '')) {
    details.push({ field: 'email', message: 'Invalid email address.' });
  }
  if (length(body?.subject) < 1 || length(body?.subject) > 150) {
    details.push({ field: 'subject', message: 'Enter a subject (150 characters max).' });
  }
  if (length(body?.message) < 10 || length(body?.message) > 2000) {
    details.push({ field: 'message', message: 'Your message must be between 10 and 2000 characters.' });
  }
  if (details.length > 0) {
    return fail(req, 400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request data.', details } });
  }
  return respond({ success: true, id: nextContactId++ }, 700, 201); // 201 = message créé
}

function respond<T>(body: T, delayMs = NETWORK_DELAY_MS, status = 200): Observable<HttpResponse<T>> { // réponse après un petit délai
  return of(new HttpResponse({ status, body })).pipe(delay(delayMs));
}

function fail(req: HttpRequest<unknown>, status: number, body: ApiError): Observable<never> { // erreur HTTP après un petit délai
  return timer(NETWORK_DELAY_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status, error: body, url: req.url }))),
  );
}
