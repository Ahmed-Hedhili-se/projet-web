import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { MOCK_ACCOUNTS } from '../../../core/mocks/mock-users';
import { AuthService } from '../../../core/services/auth-service';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  let httpTesting: HttpTestingController;
  const jane = MOCK_ACCOUNTS[0].user;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);

    TestBed.inject(AuthService).login({ email: jane.email, password: 'Password123' }).subscribe();
    httpTesting
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ token: 'mock-token-3', user: jane });
  });

  it('should show the user and the WRONG_PASSWORD message under the current password', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    httpTesting.expectOne(`${environment.apiUrl}/users/me`).flush({ user: jane });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Jane');
    expect(compiled.textContent).toContain('JD');

    const page = fixture.componentInstance as unknown as {
      passwordForm: ProfilePage['passwordForm'];
    };
    page.passwordForm.setValue({
      currentPassword: 'wrong',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    });
    const updateButton = [...compiled.querySelectorAll('button[type="submit"]')].find((button) =>
      button.textContent?.includes('Update password'),
    );
    (updateButton as HTMLButtonElement | undefined)?.click();

    const req = httpTesting.expectOne(`${environment.apiUrl}/users/me/password`);
    expect(req.request.body).toEqual({ currentPassword: 'wrong', newPassword: 'NewPassword1' });
    req.flush(
      { error: { code: 'WRONG_PASSWORD', message: 'Your current password is incorrect.' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Your current password is incorrect.');
  });
});
