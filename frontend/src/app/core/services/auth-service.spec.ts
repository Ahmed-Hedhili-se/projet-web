import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MOCK_ACCOUNTS } from '../mocks/mock-users';
import { AuthService } from './auth-service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  const jane = MOCK_ACCOUNTS[0].user; // utilisateur USER de démonstration

  beforeEach(() => {
    localStorage.clear(); // chaque test part d'une session vide
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should store the token and the user after a successful login', () => {
    service.login({ email: jane.email, password: 'Password123' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/auth/login`).flush({ token: 'abc', user: jane });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.currentUser()?.firstName).toBe('Jane');
    expect(localStorage.getItem('teramind_token')).toBe('abc'); // la session survit au rafraîchissement
  });

  it('should forget everything on logout', () => {
    service.login({ email: jane.email, password: 'Password123' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/auth/login`).flush({ token: 'abc', user: jane });

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('teramind_token')).toBeNull();
  });
});
