import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MOCK_GPUS } from '../../../core/mocks/mock-gpus';
import { environment } from '../../../../environments/environment';
import { AdminGpusPage } from './admin-gpus-page';

describe('AdminGpusPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminGpusPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('should list the GPUs, filter the inactive ones and open the form with ?new=1', async () => {
    const fixture = TestBed.createComponent(AdminGpusPage);
    fixture.componentRef.setInput('new', '1');             // ?new=1
    await fixture.whenStable();
    httpTesting.expectOne(`${environment.apiUrl}/admin/gpus`).flush({ gpus: MOCK_GPUS.map((gpu) => ({ ...gpu, rentalCount: 2 })), total: 7 });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Add a GPU');   // le panneau d'ajout est ouvert
    expect(compiled.textContent).toContain('7 of 7 GPUs');

    [...compiled.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Inactive')?.click();
    await fixture.whenStable();
    expect(compiled.textContent).toContain('1 of 7 GPUs'); // seulement le V100 désactivé
  });
});
