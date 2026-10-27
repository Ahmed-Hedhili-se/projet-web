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
  {
    path: 'gpus',
    title: 'GPU catalog | NeuroGrid',
    loadComponent: () => import('./pages/public/gpu-catalog/gpu-catalog-page').then((m) => m.GpuCatalogPage),
  },
  {
    path: 'gpus/:id',                                      // :id est transmis à l'input « id » de la page
    title: 'GPU details | NeuroGrid',
    loadComponent: () => import('./pages/public/gpu-detail/gpu-detail-page').then((m) => m.GpuDetailPage),
  },
  {
    path: 'recommend',
    title: 'GPU recommendation | NeuroGrid',
    loadComponent: () => import('./pages/public/recommend/recommend-page').then((m) => m.RecommendPage),
  },
  { path: 'contact', title: 'Contact | NeuroGrid', loadComponent: comingSoon, data: { heading: 'Contact' } },              // F5
  { path: 'login', title: 'Sign in | NeuroGrid', loadComponent: comingSoon, data: { heading: 'Sign in' } },                // F6
  { path: 'register', title: 'Create an account | NeuroGrid', loadComponent: comingSoon, data: { heading: 'Create an account' } }, // F6
  { path: 'account/rentals/new', title: 'New rental | NeuroGrid', loadComponent: comingSoon, data: { heading: 'New rental' } }, // F7
  {
    path: '**',                                            // toute autre URL → page 404 (doit rester en dernier)
    title: 'Page not found | NeuroGrid',
    loadComponent: () => import('./pages/public/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
