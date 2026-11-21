import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { GpuService } from './gpu-service';

describe('GpuService', () => {
  let service: GpuService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GpuService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should send only the filled filters as query params', () => {
    service
      .list({
        manufacturer: 'NVIDIA',
        minVram: 40,
        search: undefined,
        available: false,
        sort: 'price_asc',
      })
      .subscribe();

    const req = httpTesting.expectOne((request) => request.url === `${environment.apiUrl}/gpus`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('manufacturer')).toBe('NVIDIA');
    expect(req.request.params.get('minVram')).toBe('40');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('available')).toBe(false);
    req.flush({ gpus: [], total: 0, manufacturers: [] });
  });

  it('should call GET /gpus/:id', () => {
    service.getById(3).subscribe();

    const req = httpTesting.expectOne(`${environment.apiUrl}/gpus/3`);
    expect(req.request.method).toBe('GET');
    req.flush({ gpu: {} });
  });
});
