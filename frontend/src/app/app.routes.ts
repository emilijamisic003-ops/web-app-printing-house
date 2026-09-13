import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Register } from './pages/register/register';

export const routes: Routes = [
  { path: '', component: Home, pathMatch: 'full', title: 'Printing House | Početna' },
  { path: 'login', component: Login, title: 'Printing House | Prijava' },
  { path: 'register', component: Register, title: 'Printing House | Registracija' },
  { path: 'admin/login', component: AdminLogin, title: 'Printing House | Prijava administratora' }
];
