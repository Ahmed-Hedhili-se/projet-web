import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_GPUS } from '../../../core/mocks/mock-gpus';
import { NewRentalPage } from './new-rental-page';

describe('NewRentalPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewRentalPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('should select the GPU from the URL and estimate the total price', async () => {
    const fixture = TestBed.createComponent(NewRentalPage);
    fixture.componentRef.setInput('gpuId', '1');           // ?gpuId=1 (NVIDIA H100 80GB, 3.20 $/h)
    await fixture.whenStable();

    httpTesting.expectOne((req) => req.url.endsWith('/gpus')).flush({ gpus: MOCK_GPUS.filter((gpu) => gpu.isActive), total: 6, manufacturers: [] });
    const page = fixture.componentInstance as unknown as { form: NewRentalPage['form'] }; // accès au formulaire (protected)
    page.form.patchValue({ quantity: 2, durationHours: 10 });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('NVIDIA H100 80GB');
    expect(text).toContain('$64.00');                      // 3.20 × 2 × 10
  });
});
