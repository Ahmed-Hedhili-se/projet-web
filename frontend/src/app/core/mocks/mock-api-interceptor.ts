import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../models/api-error';
import { GpuListResponse } from '../models/gpu';
import { MOCK_GPUS } from './mock-gpus';

const NETWORK_DELAY_MS = 400;                              // simule le temps de réponse d'un vrai serveur

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => { // répond à la place du backend (environment.useMockApi)
  if (req.method !== 'GET' || !req.url.startsWith(`${environment.apiUrl}/gpus`)) {
    return next(req);                                      // route pas encore simulée : la requête part normalement
  }

  const path = req.url.slice(environment.apiUrl.length);   // ex. "/gpus" ou "/gpus/3"
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

function respond<T>(body: T): Observable<HttpResponse<T>> { // réponse 200 après un petit délai
  return of(new HttpResponse({ status: 200, body })).pipe(delay(NETWORK_DELAY_MS));
}

function fail(req: HttpRequest<unknown>, status: number, body: ApiError): Observable<never> { // erreur HTTP après un petit délai
  return timer(NETWORK_DELAY_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status, error: body, url: req.url }))),
  );
}
