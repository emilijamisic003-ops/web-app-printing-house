import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { RoleHome } from './role-home';

describe('RoleHome', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ username: 'ana' }));
    spyOn(localStorage, 'removeItem').and.callFake(() => {
      (localStorage.getItem as jasmine.Spy).and.returnValue(null);
    });
  });

  it('shows each role title and the stored username, then logs out to login', async () => {
    const harness = await RouterTestingHarness.create();
    for (const [path, title] of [['client', 'Moj profil'], ['printer', 'Profil štamparije'], ['admin', 'Administratorski panel']]) {
      (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify({ username: 'ana', role: path }));
      await harness.navigateByUrl('/' + path, RoleHome);
      const http = TestBed.inject(HttpTestingController);
      for (const request of http.match(request => request.url.includes('/users/ana'))) {
        request.flush({ username: 'ana', firstName: 'Ana', lastName: 'Test', role: path, clientType: 'individual', phone: '123', email: 'ana@example.test' });
      }
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(title);
      expect(harness.routeNativeElement?.textContent).toContain('ana');
    }
    harness.routeNativeElement?.querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(localStorage.removeItem).toHaveBeenCalledOnceWith('currentUser');
    expect(TestBed.inject(Router).url).toBe('/admin/login');
  });

  it('handles missing or malformed stored data without crashing', async () => {
    const harness = await RouterTestingHarness.create();
    for (const value of [null, '{invalid', 'null']) {
      (localStorage.getItem as jasmine.Spy).and.returnValue(value);
      await harness.navigateByUrl('/');
      await harness.navigateByUrl('/client');
      expect(TestBed.inject(Router).url).toBe('/login');
    }
  });
});
