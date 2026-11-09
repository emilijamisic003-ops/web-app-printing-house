import { Routes } from '@angular/router';
import { PrinterProcurements } from './pages/printer-procurements/printer-procurements';
import { ClientProcurements } from './pages/client-procurements/client-procurements';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';
import { RoleHome } from './pages/role-home/role-home';
import { authGuard } from './guards/auth.guard';
import { ProductDetails } from './pages/product-details/product-details';
import { Cart } from './pages/cart/cart';
import { Archive } from './pages/archive/archive';
import { AdminUsers } from './pages/admin-users/admin-users';
import { AdminRequests } from './pages/admin-requests/admin-requests';
import { AdminCategories } from './pages/admin-categories/admin-categories';
import { PrinterProducts } from './pages/printer-products/printer-products';
import { PrinterOrders } from './pages/printer-orders/printer-orders';
import { PrinterProfile } from './pages/printer-profile/printer-profile';

export const routes: Routes = [
  { path: 'client/products', component: Home, canActivate: [authGuard], data: { role: 'client', searchOnly: true }, title: 'Printing House | Pretraga proizvoda' },
  { path: 'printer/procurements', component: PrinterProcurements, canActivate: [authGuard], data: { role: 'printer' }, title: 'Printing House | Javne nabavke' },
  { path: 'client/procurements', component: ClientProcurements, canActivate: [authGuard], data: { role: 'client', clientType: 'legal' }, title: 'Printing House | Javne nabavke' },
  { path: 'client-car', component: Cart, canActivate: [authGuard], data: { role: 'client' }, title: 'Printing House | Korpa' },
  { path: 'client-archive', component: Archive, canActivate: [authGuard], data: { role: 'client' }, title: 'Printing House | Arhiva proizvoda' },
  { path: '', component: Home, pathMatch: 'full', title: 'Printing House | Početna' },
  { path: 'products/:printingHouseUsername/:code', component: ProductDetails, title: 'Printing House | Detalji proizvoda' },
  { path: 'products/:code', component: ProductDetails, title: 'Printing House | Detalji proizvoda' },
  { path: 'login', component: Login, title: 'Printing House | Prijava' },
  { path: 'register', component: Register, title: 'Printing House | Registracija' },
  { path: 'forgot-password', component: ForgotPassword, title: 'Printing House | Zaboravljena lozinka' },
  { path: 'reset-password', component: ResetPassword, title: 'Printing House | Nova lozinka' },
  { path: 'admin/login', component: AdminLogin, title: 'Printing House | Prijava administratora' },
  { path: 'admin/users', component: AdminUsers, canActivate: [authGuard], data: { title: 'Korisnici', role: 'admin' }, title: 'Printing House | Korisnici' },
  { path: 'admin/requests', component: AdminRequests, canActivate: [authGuard], data: { title: 'Zahtevi za registraciju', role: 'admin' }, title: 'Printing House | Zahtevi za registraciju' },
  { path: 'admin/categories', component: AdminCategories, canActivate: [authGuard], data: { title: 'Kategorije', role: 'admin' }, title: 'Printing House | Kategorije' },
  { path: 'client/profile', redirectTo: 'client', pathMatch: 'full' },
  { path: 'client', component: RoleHome, canActivate: [authGuard], data: { title: 'Klijent', role: 'client' }, title: 'Printing House | Klijent' },
  { path: 'printer', component: RoleHome, canActivate: [authGuard], data: { title: 'Štamparija', role: 'printer' }, title: 'Printing House | Štamparija' },
  { path: 'printer-products', component: PrinterProducts, canActivate: [authGuard], data: { title: 'Moji proizvodi', role: 'printer' }, title: 'Printing House | Moji proizvodi' },
  { path: 'printer-orders', component: PrinterOrders, canActivate: [authGuard], data: { title: 'Porudžbine', role: 'printer' }, title: 'Printing House | Porudžbine' },
  { path: 'printer-profile', component: PrinterProfile, canActivate: [authGuard], data: { title: 'Profil štamparije', role: 'printer' }, title: 'Printing House | Profil štamparije' },
  { path: 'printer/profile', redirectTo: 'printer-profile', pathMatch: 'full' },
  { path: 'admin', component: RoleHome, canActivate: [authGuard], data: { title: 'Administratorski panel', role: 'admin' }, title: 'Printing House | Administrator' }
];
