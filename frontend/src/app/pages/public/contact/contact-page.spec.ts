import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ContactPage } from './contact-page';

describe('ContactPage', () => {
  let httpTesting: HttpTestingController;                  // remplace le vrai réseau

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should show errors and send nothing when the form is empty', async () => {
    const fixture = TestBed.createComponent(ContactPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('button[type="submit"]')?.click(); // envoi du formulaire vide
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Enter a valid email address.');
    httpTesting.expectNone(`${environment.apiUrl}/contact`); // aucune requête envoyée
  });

  it('should send the message and show the confirmation', async () => {
    const fixture = TestBed.createComponent(ContactPage);
    const page = fixture.componentInstance as unknown as { form: ContactPage['form'] }; // accès au formulaire (protected)
    page.form.setValue({ name: 'Jane', email: 'jane@example.com', subject: 'Sales & pricing', message: 'I need 8 GPUs for a month.' });
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    const req = httpTesting.expectOne(`${environment.apiUrl}/contact`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Jane');
    req.flush({ success: true, id: 42 }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Thank you, Jane!');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reference #42');
  });
});
