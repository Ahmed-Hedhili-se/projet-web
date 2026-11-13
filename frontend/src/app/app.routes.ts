import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin-guard';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

const comingSoon = () =>                                   // page provisoire, chargée seulement si on visite la route
  import('./pages/coming-soon/coming-soon-page').then((m) => m.ComingSoonPage);

export const routes: Routes = [
  {
    path: '',
    title: 'TeraMind — GPU rental for AI',
    loadComponent: () => import('./pages/public/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'about',
    title: 'About | TeraMind',
    loadComponent: () => import('./pages/public/about/about-page').then((m) => m.AboutPage),
  },
  {
    path: 'gpus',
    title: 'GPU catalog | TeraMind',
    loadComponent: () => import('./pages/public/gpu-catalog/gpu-catalog-page').then((m) => m.GpuCatalogPage),
  },
  {
    path: 'gpus/:id',                                      // :id est transmis à l'input « id » de la page
    title: 'GPU details | TeraMind',
    loadComponent: () => import('./pages/public/gpu-detail/gpu-detail-page').then((m) => m.GpuDetailPage),
  },
  {
    path: 'recommend',
    title: 'GPU recommendation | TeraMind',
    loadComponent: () => import('./pages/public/recommend/recommend-page').then((m) => m.RecommendPage),
  },
  {
    path: 'contact',
    title: 'Contact | TeraMind',
    loadComponent: () => import('./pages/public/contact/contact-page').then((m) => m.ContactPage),
  },
  {
    path: 'login',
    title: 'Sign in | TeraMind',
    canActivate: [guestGuard],                             // déjà connecté → accueil
    loadComponent: () => import('./pages/public/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Create an account | TeraMind',
    canActivate: [guestGuard],                             // déjà connecté → accueil
    loadComponent: () => import('./pages/public/register/register-page').then((m) => m.RegisterPage),
  },
  {
    path: 'account/rentals/new',                           // ?gpuId=… transmis à l'input « gpuId » de la page
    title: 'New rental | TeraMind',
    canActivate: [authGuard],                              // il faut être connecté
    loadComponent: () => import('./pages/account/new-rental/new-rental-page').then((m) => m.NewRentalPage),
  },
  {
    path: 'account/rentals',
    title: 'My rentals | TeraMind',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/my-rentals/my-rentals-page').then((m) => m.MyRentalsPage),
  },
  {
    path: 'account/profile',
    title: 'Profile | TeraMind',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/profile/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: 'admin',                                         // espace admin : un cadre commun (menu) + une page par sous-route
    canActivate: [adminGuard],                             // rôle ADMIN obligatoire
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        title: 'Admin dashboard | TeraMind',
        loadComponent: () => import('./pages/admin/dashboard/admin-dashboard-page').then((m) => m.AdminDashboardPage),
      },
      {
        path: 'gpus',                                      // ?new=1 ouvre directement le formulaire d'ajout
        title: 'GPU management | TeraMind',
        loadComponent: () => import('./pages/admin/gpus/admin-gpus-page').then((m) => m.AdminGpusPage),
      },
      { path: 'users', title: 'Users | TeraMind', loadComponent: comingSoon, data: { heading: 'User management' } },          // F8, partie 2
      { path: 'rentals', title: 'Rentals | TeraMind', loadComponent: comingSoon, data: { heading: 'Rental management' } },    // F8, partie 2
      { path: 'messages', title: 'Messages | TeraMind', loadComponent: comingSoon, data: { heading: 'Contact messages' } },   // F8, partie 3
    ],
  },
  {
    path: '**',                                            // toute autre URL → page 404 (doit rester en dernier)
    title: 'Page not found | TeraMind',
    loadComponent: () => import('./pages/public/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
