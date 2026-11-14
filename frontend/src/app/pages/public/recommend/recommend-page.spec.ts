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
    if (loggedIn) {                                        // session de Jane, relue par AuthService au démarrage
      localStorage.setItem('teramind_token', 'mock-token-3');
      localStorage.setItem('teramind_user', JSON.stringify(MOCK_ACCOUNTS[0].user));
    }
    await TestBed.configureTestingModule({
      imports: [RecommendPage],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor, mockApiInterceptor]))], // jeton de connexion + API simulée
    }).compileComponents();
    const fixture = TestBed.createComponent(RecommendPage);
    fixture.detectChanges();
    return { fixture, compiled: fixture.nativeElement as HTMLElement };
  };

  const until = async (fixture: ComponentFixture<RecommendPage>, check: () => boolean) => { // attend une réponse de l'API simulée (délais réels)
    for (let i = 0; i < 80 && !check(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();                             // met la page à jour
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
    await until(fixture, () => compiled.querySelector('textarea') !== null); // statut chargé : le chat est affiché
    expect(compiled.textContent).toContain('0 / 30 messages today');

    clickButton(compiled, 'Fine-tune Llama 3.1 8B with QLoRA');      // exemple cliquable : remplit le message
    fixture.detectChanges();
    expect((compiled.querySelector('textarea') as HTMLTextAreaElement).value).toContain('300M tokens');

    clickButton(compiled, 'Send');
    await until(fixture, () => compiled.textContent?.includes('Best architecture') ?? false);

    expect(compiled.textContent).toContain('What the AI understood');
    expect(compiled.textContent).toContain('1 / 30 messages today');
    expect(compiled.querySelector('a[href="/account/rentals/new?gpuId=1&quantity=4"]')?.textContent).toContain('Rent this');
    expect(compiled.textContent).toContain('What if I use FP8?');    // réponses rapides
  });
});
