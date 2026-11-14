import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ContactMessage } from '../../../core/models/contact';
import { AdminService } from '../../../core/services/admin-service';
import { AdminMessagesPage } from './admin-messages-page';

describe('AdminMessagesPage', () => {
  let httpTesting: HttpTestingController;
  const messages: ContactMessage[] = [
    { id: 12, name: 'John Smith', email: 'john.smith@example.com', subject: 'Volume pricing', message: 'Hello, do you offer discounts for 30-day rentals of 8 GPUs?', isRead: false, createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString() },
    { id: 9, name: 'Ines Duarte', email: 'ines.duarte@example.com', subject: 'Partnership', message: 'We are a university lab and would like to discuss a partnership.', isRead: true, createdAt: new Date(Date.now() - 120 * 3_600_000).toISOString() },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMessagesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  const clickButton = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)?.click();

  it('should mark a message as read when it is opened, then delete it', async () => {
    const fixture = TestBed.createComponent(AdminMessagesPage);
    const adminService = TestBed.inject(AdminService);
    await fixture.whenStable();
    httpTesting.expectOne(`${environment.apiUrl}/admin/messages`).flush({ messages, total: 2, unread: 1 });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(adminService.unreadMessages()).toBe(1);
    expect(compiled.textContent).toContain('2 hours ago');

    (compiled.querySelector('li button') as HTMLButtonElement).click();
    const patch = httpTesting.expectOne(`${environment.apiUrl}/admin/messages/12`);
    expect(patch.request.body).toEqual({ isRead: true });
    patch.flush({ message: { ...messages[0], isRead: true } });
    await fixture.whenStable();

    expect(adminService.unreadMessages()).toBe(0);
    expect(compiled.querySelector('a[href^="mailto:john.smith@example.com"]')?.getAttribute('href')).toContain('subject=Re%3A%20Volume%20pricing');

    clickButton(compiled, 'Delete');
    await fixture.whenStable();
    const confirm = [...compiled.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'Delete').at(-1);
    confirm?.click();
    const request = httpTesting.expectOne(`${environment.apiUrl}/admin/messages/12`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(compiled.textContent).toContain('The message from John Smith was deleted.');
    expect(compiled.querySelectorAll('li button').length).toBe(1);
  });
});
