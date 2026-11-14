import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from '../../../core/interceptors/auth-interceptor';
import { mockApiInterceptor } from '../../../core/mocks/mock-api-interceptor';
import { MOCK_ACCOUNTS } from '../../../core/mocks/mock-users';
import { RecommendPage } from './recommend-page';

describe('RecommendPage', () => {
  const setup = async (loggedIn: boolean) => {
    localStorage.clear();
    if (loggedIn) {
      localStorage.setItem('teramind_token', 'mock-token-3');
      localStorage.setItem('teramind_user', JSON.stringify(MOCK_ACCOUNTS[0].user));
    }
    await TestBed.configureTestingModule({
      imports: [RecommendPage],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor, mockApiInterceptor]))],
    }).compileComponents();
    const fixture = TestBed.createComponent(RecommendPage);
    fixture.detectChanges();
    return { fixture, compiled: fixture.nativeElement as HTMLElement };
  };

  const until = async (fixture: ComponentFixture<RecommendPage>, check: () => boolean) => {
    for (let i = 0; i < 80 && !check(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();
    }
  };
  const clickButton = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)?.click();

  it('should ask a visitor to sign in and still offer the quick form', async () => {
    const { fixture, compiled } = await setup(false);
    expect(compiled.textContent).toContain('Sign in to use the AI advisor');
    expect(compiled.querySelector('a[href="/login?returnUrl=%2Frecommend"]')).not.toBeNull();

    clickButton(compiled, 'Quick form');
    fixture.detectChanges();
    expect(compiled.querySelectorAll('input[type="radio"][formcontrolname="modelType"]').length).toBe(5);
  });

  it('should send a message to the AI advisor and show the recommended configurations', async () => {
    const { fixture, compiled } = await setup(true);
    await until(fixture, () => compiled.querySelector('textarea') !== null);
    expect(compiled.textContent).toContain('0 / 30 messages today');

    clickButton(compiled, 'Fine-tune Llama 3.1 8B with QLoRA');
    fixture.detectChanges();
    expect((compiled.querySelector('textarea') as HTMLTextAreaElement).value).toContain('300M tokens');

    clickButton(compiled, 'Send');
    await until(fixture, () => compiled.textContent?.includes('Best architecture') ?? false);

    expect(compiled.textContent).toContain('What the AI understood');
    expect(compiled.textContent).toContain('1 / 30 messages today');
    expect(compiled.querySelector('a[href="/account/rentals/new?gpuId=1&quantity=4"]')?.textContent).toContain('Rent this');
    expect(compiled.textContent).toContain('What if I use FP8?');
  });

  it('should keep the conversation in the history, reopen it and delete it', async () => {
    const { fixture, compiled } = await setup(true);
    await until(fixture, () => compiled.querySelector('textarea') !== null);
    clickButton(compiled, 'Serve Mistral 7B');
    fixture.detectChanges();
    clickButton(compiled, 'Send');
    await until(fixture, () => compiled.querySelector('app-advisor-history li button') !== null);
    expect(compiled.querySelector('app-advisor-history')?.textContent).toContain('Serve Mistral 7B for 50 concurrent users');

    clickButton(compiled, 'New conversation');
    fixture.detectChanges();
    expect(compiled.textContent).toContain('What do you want to run?');

    (compiled.querySelector('app-advisor-history li button') as HTMLButtonElement).click();
    await until(fixture, () => compiled.querySelectorAll('app-advisor-message').length === 2);
    expect(compiled.textContent).toContain('Best architecture');

    (compiled.querySelector('app-advisor-history button[aria-label^="Delete"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Delete this conversation?');
    clickButton(compiled, 'Delete');
    await until(fixture, () => compiled.textContent?.includes('No conversation yet') ?? false);
    expect(compiled.textContent).toContain('What do you want to run?');
  });
});
