import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Rental } from '../../../core/models/rental';
import { MyRentalsPage } from './my-rentals-page';

describe('MyRentalsPage', () => {
  let httpTesting: HttpTestingController;
  const gpu = {
    id: 1,
    name: 'NVIDIA H100 80GB',
    manufacturer: 'NVIDIA',
    vramGb: 80,
    pricePerHour: 3.2,
  };
  const upcoming: Rental = {
    id: 15,
    quantity: 2,
    startDate: '2099-01-01T09:00:00.000Z',
    durationHours: 48,
    endDate: '2099-01-03T09:00:00.000Z',
    totalPrice: 307.2,
    status: 'UPCOMING',
    cancelledAt: null,
    createdAt: '2026-10-26T10:15:00.000Z',
    gpu,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyRentalsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should list the rentals and cancel an upcoming one after confirmation', async () => {
    const fixture = TestBed.createComponent(MyRentalsPage);
    await fixture.whenStable();
    httpTesting
      .expectOne(`${environment.apiUrl}/rentals/me`)
      .flush({ rentals: [upcoming], total: 1 });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('NVIDIA H100 80GB');

    const cancelButton = [...compiled.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Cancel rental'),
    );
    cancelButton?.click(); // ouvre la fenêtre de confirmation
    await fixture.whenStable();
    expect(compiled.textContent).toContain('Cancel this rental?');

    const confirmButton = [...compiled.querySelectorAll('[role="alertdialog"] button')].find(
      (button) => button.textContent?.includes('Cancel rental'),
    );
    (confirmButton as HTMLButtonElement | undefined)?.click();
    const req = httpTesting.expectOne(`${environment.apiUrl}/rentals/15/cancel`);
    expect(req.request.method).toBe('PATCH');
    req.flush({
      rental: { ...upcoming, status: 'CANCELLED', cancelledAt: '2026-11-05T08:00:00.000Z' },
    });
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Cancelled on');
  });
});
