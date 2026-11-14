import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin-guard';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

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
    path: 'gpus/:id',
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
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/public/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Create an account | TeraMind',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/public/register/register-page').then((m) => m.RegisterPage),
  },
  {
    path: 'account/rentals/new',
    title: 'New rental | TeraMind',
    canActivate: [authGuard],
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
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        title: 'Admin dashboard | TeraMind',
        loadComponent: () => import('./pages/admin/dashboard/admin-dashboard-page').then((m) => m.AdminDashboardPage),
      },
      {
        path: 'gpus',
        title: 'GPU management | TeraMind',
        loadComponent: () => import('./pages/admin/gpus/admin-gpus-page').then((m) => m.AdminGpusPage),
      },
      {
        path: 'users',
        title: 'User management | TeraMind',
        loadComponent: () => import('./pages/admin/users/admin-users-page').then((m) => m.AdminUsersPage),
      },
      {
        path: 'rentals',
        title: 'Rental management | TeraMind',
        loadComponent: () => import('./pages/admin/rentals/admin-rentals-page').then((m) => m.AdminRentalsPage),
      },
      {
        path: 'messages',
        title: 'Contact messages | TeraMind',
        loadComponent: () => import('./pages/admin/messages/admin-messages-page').then((m) => m.AdminMessagesPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found | TeraMind',
    loadComponent: () => import('./pages/public/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
