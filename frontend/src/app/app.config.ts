import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { mockApiInterceptor } from './core/mocks/mock-api-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),                  // affiche les erreurs non gérées dans la console
    provideRouter(
      routes,
      withComponentInputBinding(),                         // data, paramètres et query de la route → input() du composant
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }), // remonte en haut de la page à chaque navigation
      withViewTransitions({ skipInitialTransition: true }), // fondu entre les pages (pas au premier chargement)
    ),
    provideHttpClient(
      withFetch(),                                         // utilise l'API fetch du navigateur
      withInterceptors(environment.useMockApi ? [mockApiInterceptor] : []), // données fictives tant que le backend n'est pas prêt
    ),
  ],
};
