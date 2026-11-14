import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AdminStats } from '../../../core/models/admin';
import { AdminDashboardPage } from './admin-dashboard-page';

describe('AdminDashboardPage', () => {
  let httpTesting: HttpTestingController;
  const stats: AdminStats = {
    users: { total: 42, admins: 2, blocked: 1 },
    gpus: { total: 7, active: 6, totalUnits: 60 },
    rentals: { total: 128, upcoming: 14, active: 9, completed: 95, cancelled: 10 },
    revenue: { total: 48250.4, last30Days: 9120.75 },
    messages: { total: 23, unread: 4 },
    topGpus: [{ gpuId: 1, name: 'NVIDIA H100 80GB', rentalCount: 37, revenue: 21540 }],
    rentalsPerMonth: [
      { month: '2026-06', count: 18, revenue: 6230 }, { month: '2026-07', count: 20, revenue: 7012.25 },
      { month: '2026-08', count: 22, revenue: 8104 }, { month: '2026-09', count: 27, revenue: 10950.9 },
      { month: '2026-10', count: 29, revenue: 11852.75 }, { month: '2026-11', count: 12, revenue: 4100.5 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('should show the key figures, the top GPU and a table view of the chart', async () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    await fixture.whenStable();
    httpTesting.expectOne(`${environment.apiUrl}/admin/stats`).flush(stats);
    httpTesting.expectOne(`${environment.apiUrl}/admin/gpus`).flush({ gpus: [], total: 0 });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('$9,120.75');
    expect(compiled.textContent).toContain('NVIDIA H100 80GB');
    expect(compiled.querySelectorAll('button[aria-label*="rentals"]').length).toBe(6);

    [...compiled.querySelectorAll('button')].find((button) => button.textContent?.includes('View as table'))?.click();
    await fixture.whenStable();
    expect(compiled.querySelectorAll('tbody tr').length).toBe(6);
  });
});
