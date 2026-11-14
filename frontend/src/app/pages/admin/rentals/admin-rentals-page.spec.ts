import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AdminRental } from '../../../core/models/admin';
import { RentalStatus } from '../../../core/models/rental';
import { AdminRentalsPage } from './admin-rentals-page';

describe('AdminRentalsPage', () => {
  let httpTesting: HttpTestingController;
  const HOUR_MS = 60 * 60 * 1000;
  const jane = { id: 3, email: 'jane.doe@example.com', firstName: 'Jane', lastName: 'Doe' };
  const lucas = { id: 4, email: 'lucas.martin@example.com', firstName: 'Lucas', lastName: 'Martin' };
  const h100 = { id: 1, name: 'NVIDIA H100 80GB', manufacturer: 'NVIDIA', vramGb: 80, pricePerHour: 3.2 };

  const rental = (id: number, user: AdminRental['user'], status: RentalStatus, startOffsetHours: number): AdminRental => {
    const start = Date.now() + startOffsetHours * HOUR_MS; // dates autour de maintenant : visibles dans le planning
    return {
      id, quantity: 2, durationHours: 24, totalPrice: 153.6, status, cancelledAt: null, gpu: h100, user,
      startDate: new Date(start).toISOString(), endDate: new Date(start + 24 * HOUR_MS).toISOString(), createdAt: new Date(start - 72 * HOUR_MS).toISOString(),
    };
  };
  const rentals = [rental(15, jane, 'UPCOMING', 48), rental(14, jane, 'ACTIVE', -6), rental(17, lucas, 'ACTIVE', -3)];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRentalsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  const clickButton = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)?.click();

  it('should apply the ?userId filter, cancel a rental and draw the planning', async () => {
    const fixture = TestBed.createComponent(AdminRentalsPage);
    fixture.componentRef.setInput('userId', '3');          // ?userId=3 : seulement les locations de Jane
    await fixture.whenStable();
    httpTesting.expectOne(`${environment.apiUrl}/admin/rentals`).flush({ rentals, total: 3 });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('2 of 3 rentals');
    expect(compiled.textContent).not.toContain('lucas.martin@example.com');

    clickButton(compiled, 'Cancel');                       // première ligne : la location 15
    await fixture.whenStable();
    clickButton(compiled, 'Cancel rental');                // confirmation
    const request = httpTesting.expectOne(`${environment.apiUrl}/admin/rentals/15/cancel`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ rental: { ...rentals[0], status: 'CANCELLED', cancelledAt: new Date().toISOString() } });
    await fixture.whenStable();
    expect(compiled.textContent).toContain('Rental #15 of Jane Doe was cancelled.');

    clickButton(compiled, 'Planning');
    await fixture.whenStable();
    expect(compiled.querySelectorAll('.planning-track button').length).toBe(1); // la location annulée n'est plus dessinée
    expect(compiled.querySelector('.planning-track button')?.textContent).toContain('Jane D. ×2');
  });
});
