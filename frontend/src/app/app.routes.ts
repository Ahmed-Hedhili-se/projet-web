import { Routes } from '@angular/router';

const comingSoon = () =>                                   // page provisoire, chargée seulement si on visite la route
  import('./pages/coming-soon/coming-soon-page').then((m) => m.ComingSoonPage);

export const routes: Routes = [
  {
    path: '',
    title: 'NeuroGrid — GPU rental for AI',
    loadComponent: () => import('./pages/public/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'about',
    title: 'About | NeuroGrid',
    loadComponent: () => import('./pages/public/about/about-page').then((m) => m.AboutPage),
  },
  { path: 'gpus', title: 'GPU catalog | NeuroGrid', loadComponent: comingSoon, data: { heading: 'GPU catalog' } },         // F3
  { path: 'recommend', title: 'GPU recommendation | NeuroGrid', loadComponent: comingSoon, data: { heading: 'GPU recommendation' } }, // F4
  { path: 'contact', title: 'Contact | NeuroGrid', loadComponent: comingSoon, data: { heading: 'Contact' } },              // F5
  { path: 'login', title: 'Sign in | NeuroGrid', loadComponent: comingSoon, data: { heading: 'Sign in' } },                // F6
  { path: 'register', title: 'Create an account | NeuroGrid', loadComponent: comingSoon, data: { heading: 'Create an account' } }, // F6
  {
    path: '**',                                            // toute autre URL → page 404 (doit rester en dernier)
    title: 'Page not found | NeuroGrid',
    loadComponent: () => import('./pages/public/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
