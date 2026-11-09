import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup() {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    spyOn(localStorage, 'setItem');
    const fixture = TestBed.createComponent(LoginForm);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance,
      page: fixture.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController) };
  }

  it('shows required errors and sends no request for an empty form', () => {
    const { fixture, page, http } = setup();
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(page.querySelector('#username-error')?.textContent).toContain('Unesite korisničko ime');
    expect(page.querySelector('#password-error')?.textContent).toContain('Unesite lozinku');
    http.expectNone('http://localhost:4000/users/login');
  });

  it('posts credentials, stores the response and shows success', () => {
    const { fixture, component, page, http } = setup();
    for (const [id, value] of [['username', 'klijent'], ['password', 'Primer12!']]) {
      const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    component.submit();
    const request = http.expectOne('http://localhost:4000/users/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'klijent', password: 'Primer12!' });
    expect(component.user).toBeNull();
    expect(component.isSubmitting).toBeTrue();
    const user = { username: 'klijent', firstName: 'Ana', lastName: 'Anić',
      email: 'ana@example.com', role: 'client', clientType: 'individual' };
    request.flush(user);
    fixture.detectChanges();
    expect(component.user).toEqual(user);
    expect(page.querySelector('.status')?.textContent).toContain('Uspešno ste se prijavili');
    expect(component.isSubmitting).toBeFalse();
    expect(localStorage.setItem).toHaveBeenCalledWith('currentUser', JSON.stringify(user));
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/client']);

    component.submit();
    expect(component.user).toBeNull();
    expect(component.successMessage).toBe('');
    http.expectOne('http://localhost:4000/users/login').flush(
      { message: 'Pogrešno korisničko ime ili lozinka' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Pogrešno korisničko ime ili lozinka');
  });

  it('displays backend errors and lets the user retry', () => {
    const { fixture, component, page, http } = setup();
    component.form.setValue({ username: 'klijent', password: 'Primer12!' });
    for (const status of [401, 403, 500]) {
      component.submit();
      http.expectOne('http://localhost:4000/users/login').flush(
        { message: 'Poruka sa servera' }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(page.querySelector('[role="alert"]')?.textContent).toBe('Poruka sa servera');
      expect(component.user).toBeNull();
      expect(component.isSubmitting).toBeFalse();
    }
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('redirects printers and admins to their role pages', () => {
    const { component, http } = setup();
    component.form.setValue({ username: 'korisnik', password: 'Primer12!' });
    for (const role of ['printer', 'admin']) {
      const user = { username: 'korisnik', firstName: 'Ana', lastName: 'Anić',
        email: 'ana@example.com', role, clientType: null };
      component.submit();
      http.expectOne('http://localhost:4000/users/login').flush(user);
      expect(localStorage.setItem).toHaveBeenCalledWith('currentUser', JSON.stringify(user));
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/' + role]);
    }
  });

  it('shows a fallback message when the server cannot be reached', () => {
    const { fixture, component, page, http } = setup();
    component.form.setValue({ username: 'klijent', password: 'Primer12!' });
    component.submit();
    http.expectOne('http://localhost:4000/users/login').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Prijava trenutno nije moguća');
    expect(component.isSubmitting).toBeFalse();
  });
});
