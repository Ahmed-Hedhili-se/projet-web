import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { RegisterPage } from './register-page';

describe('RegisterPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function fillForm(page: { form: RegisterPage['form'] }, confirmPassword: string): void {
    page.form.setValue({
      firstName: 'Jane', lastName: 'Doe', email: 'jane.new@example.com',
      password: 'Password123', confirmPassword, acceptTerms: true,
    });
  }

  it('should refuse different passwords and send nothing', async () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fillForm(fixture.componentInstance as unknown as { form: RegisterPage['form'] }, 'Different123');
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Passwords do not match.');
    httpTesting.expectNone(`${environment.apiUrl}/auth/register`);
  });

  it('should send only the API fields and show EMAIL_TAKEN under the email', async () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fillForm(fixture.componentInstance as unknown as { form: RegisterPage['form'] }, 'Password123');
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    const req = httpTesting.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.body).toEqual({ email: 'jane.new@example.com', password: 'Password123', firstName: 'Jane', lastName: 'Doe' });
    req.flush({ error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' } }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('An account with this email already exists.');
  });
});
