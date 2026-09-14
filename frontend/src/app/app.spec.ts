import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)]
    }).compileComponents();
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
