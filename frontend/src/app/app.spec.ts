import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './services/auth.service';

describe('App', () => {
  let previousUser: string | null;
  beforeEach(() => {
    previousUser = localStorage.getItem('currentUser');
    localStorage.removeItem('currentUser');
  });
  afterEach(() => {
    if (previousUser === null) localStorage.removeItem('currentUser');
    else localStorage.setItem('currentUser', previousUser);
  });
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('updates the persistent header after login, return to home and logout', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('header a[href="/login"]')).not.toBeNull();
    expect(page.querySelector('header a[href="/register"]')).not.toBeNull();
    expect(page.querySelector('header a[href="/client-car"]')).toBeNull();
    for (const [id, value] of [['username', 'ana.client'], ['password', 'Primer12!']]) {
      const input = page.querySelector('#' + id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/login')
      .flush({ username: 'ana.client', role: 'client' });
    await fixture.whenStable();
    expect(router.url).toBe('/client');
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector('header a[href="/client"]')?.textContent).toBe('Profil');
    expect(page.querySelector('header a[href="/login"]')).toBeNull();
    expect(page.querySelector('header a[href="/register"]')).toBeNull();
    page.querySelector<HTMLButtonElement>('header button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/');
    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(page.querySelector('header a[href="/login"]')).not.toBeNull();
  });

  for (const role of ['client', 'printer', 'admin']) {
    it('redirects an already logged-in ' + role + ' from login and links to their profile', async () => {
      localStorage.setItem('currentUser', JSON.stringify({ username: 'user', role }));
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/login');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/' + role);
      expect(fixture.nativeElement.querySelector('app-login-form')).toBeNull();
      expect(fixture.nativeElement.querySelector('header a[href="' + (role === 'printer' ? '/printer-profile' : '/' + role) + '"]').textContent).toBe('Profil');
      expect(!!fixture.nativeElement.querySelector('header a[href="/client-car"]')).toBe(role === 'client');
    });
  }

  it('treats missing or malformed stored users as logged out', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.getCurrentUser()).toBeNull();
    for (const value of ['bad JSON', 'null', 'false', '[]']) {
      localStorage.setItem('currentUser', value);
      expect(auth.getCurrentUser()).toBeNull();
      expect(auth.isLoggedIn()).toBeFalse();
      expect(auth.getHomeRouteForCurrentUser()).toBe('/');
    }
  });

  it('navigates to password recovery and opens reset directly, with links back to login', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const page = fixture.nativeElement as HTMLElement;
    await router.navigateByUrl('/login');
    await fixture.whenStable();
    fixture.detectChanges();
    page.querySelector<HTMLAnchorElement>('a[href="/forgot-password"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/forgot-password');
    expect(page.querySelector('main h1')?.textContent).toBe('Zaboravljena lozinka?');
    page.querySelector<HTMLAnchorElement>('main a[href="/login"]')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/login');

    await router.navigateByUrl('/reset-password');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector('main h1')?.textContent).toBe('Postavite novu lozinku');
    expect(page.querySelector('header')).not.toBeNull();
    expect(page.querySelector('footer')).not.toBeNull();
    page.querySelector<HTMLAnchorElement>('main a[href="/login"]')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/login');
  });

  it('should render the public home page at / with the shared header and footer', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('header')).not.toBeNull();
    expect(page.querySelector('main h1')?.textContent).toContain('Printing House');
    expect(page.querySelector('footer')).not.toBeNull();
  });

  it('opens public login from the header and keeps admin login separate', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLAnchorElement>('header a[href="/login"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/login');
    expect(page.querySelector('main h1')?.textContent).toBe('Prijava');
    expect(page.querySelector('.public-actions')?.textContent).toContain('Zaboravljena lozinka?');
    expect(page.querySelector('.public-actions')?.textContent).toContain('Registracija');

    page.querySelector<HTMLAnchorElement>('a[href="/register"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/register');
    expect(page.querySelector('main h1')?.textContent).toBe('Registracija');

    await router.navigateByUrl('/admin/login');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector('main h1')?.textContent).toBe('Prijava administratora');
    expect(page.querySelector('.public-actions')).toBeNull();
    expect(page.querySelector('input[type="password"]')).not.toBeNull();
    expect(page.querySelector('header')).not.toBeNull();
    expect(page.querySelector('footer')).not.toBeNull();
  });
});
