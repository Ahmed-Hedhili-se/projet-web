import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should show errors and send nothing when the form is empty', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Enter a valid email address.');
    expect(compiled.textContent).toContain('Enter your password.');
    httpTesting.expectNone(`${environment.apiUrl}/auth/login`); // aucune requête envoyée
  });

  it('should display the API message when the credentials are wrong', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    const page = fixture.componentInstance as unknown as { form: LoginPage['form'] }; // accès au formulaire (protected)
    page.form.setValue({ email: 'jane.doe@example.com', password: 'wrong' });
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.click();
    httpTesting
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Invalid email or password.',
    );
  });
});
