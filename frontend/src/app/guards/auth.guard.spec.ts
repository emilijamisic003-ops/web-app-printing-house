import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
    spyOn(localStorage, 'getItem').and.returnValue(null);
  });

  it('redirects missing, invalid and unknown-role users to login on every protected route', async () => {
    const harness = await RouterTestingHarness.create();
    for (const stored of [null, '{invalid', 'null', '{}', '{"role":"unknown"}']) {
      (localStorage.getItem as jasmine.Spy).and.returnValue(stored);
      for (const path of ['client', 'client/profile', 'printer', 'admin', 'client-car']) {
        await harness.navigateByUrl('/' + path);
        expect(TestBed.inject(Router).url).toBe(path === 'admin' ? '/admin/login' : '/login');
      }
    }
    expect(localStorage.getItem).toHaveBeenCalledWith('currentUser');
  });

  it('allows each role only its own home and redirects attempts to visit other homes', async () => {
    const harness = await RouterTestingHarness.create();
    for (const role of ['client', 'printer', 'admin']) {
      (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify({ username: 'ana', role }));
      for (const path of ['client', 'printer', 'admin']) {
        await harness.navigateByUrl('/login');
        await harness.navigateByUrl('/' + path);
        expect(TestBed.inject(Router).url).toBe('/' + role);
        expect(harness.routeNativeElement?.querySelector('h1')).not.toBeNull();
      }
    }
  });

  it('keeps public login and admin login accessible without a saved user', async () => {
    const harness = await RouterTestingHarness.create();
    for (const path of ['/login', '/admin/login']) {
      await harness.navigateByUrl(path);
      expect(TestBed.inject(Router).url).toBe(path);
    }
  });
});
