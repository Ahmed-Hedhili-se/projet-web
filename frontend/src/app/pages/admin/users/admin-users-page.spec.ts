import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AdminUser } from '../../../core/models/admin';
import { AdminUsersPage } from './admin-users-page';

describe('AdminUsersPage', () => {
  let httpTesting: HttpTestingController;
  const users: AdminUser[] = [
    {
      id: 3,
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'USER',
      isBlocked: false,
      createdAt: '2026-10-20T14:32:10.000Z',
      rentalCount: 4,
    },
    {
      id: 9,
      email: 'blocked@example.com',
      firstName: 'Sam',
      lastName: 'Blocked',
      role: 'USER',
      isBlocked: true,
      createdAt: '2026-10-15T09:00:00.000Z',
      rentalCount: 0,
    },
    {
      id: 1,
      email: 'admin@teramind.example',
      firstName: 'Amira',
      lastName: 'Haddad',
      role: 'ADMIN',
      isBlocked: false,
      createdAt: '2026-10-01T08:00:00.000Z',
      rentalCount: 1,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  const clickButton = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === label)
      ?.click();

  it('should list the users, filter the blocked ones and block a user after confirmation', async () => {
    const fixture = TestBed.createComponent(AdminUsersPage);
    await fixture.whenStable();
    httpTesting.expectOne(`${environment.apiUrl}/admin/users`).flush({ users, total: 3 });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('3 of 3 users');
    expect(compiled.textContent).toContain('jane.doe@example.com');

    clickButton(compiled, 'Blocked');
    await fixture.whenStable();
    expect(compiled.textContent).toContain('1 of 3 users');

    clickButton(compiled, 'All');
    await fixture.whenStable();
    clickButton(compiled, 'Block');
    await fixture.whenStable();
    expect(compiled.textContent).toContain('Block this account?');

    clickButton(compiled, 'Block account');
    const request = httpTesting.expectOne(`${environment.apiUrl}/admin/users/3`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ isBlocked: true });
    const { rentalCount, ...jane } = users[0];
    request.flush({ user: { ...jane, isBlocked: true } });
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Jane Doe was blocked.');
    expect(compiled.querySelector('tbody tr')?.textContent).toContain('Unblock');
    expect(compiled.querySelector('tbody tr')?.textContent).toContain('4');
  });
});
