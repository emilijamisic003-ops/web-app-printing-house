import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('rejects blank identifiers and posts username/email once', () => {
    const page = TestBed.createComponent(ForgotPassword).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    page.form.controls.identifier.setValue('   ');
    page.submit();
    expect(page.form.invalid).toBeTrue();
    http.expectNone('http://localhost:4000/users/forgot-password');
    for (const value of ['klijent', 'klijent@example.com']) {
      page.form.controls.identifier.setValue(value);
      page.submit(); page.submit();
      const request = http.expectOne('http://localhost:4000/users/forgot-password');
      expect(request.request.body).toEqual({ identifier: value });
      request.flush({ message: 'Ako postoji nalog, link je poslat.' });
      expect(page.statusMessage).toContain('Ako postoji nalog');
      expect(page.submitting).toBeFalse();
    }
  });

  it('shows the backend email error and allows retry', () => {
    const page = TestBed.createComponent(ForgotPassword).componentInstance;
    page.form.controls.identifier.setValue('klijent');
    page.submit();
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/forgot-password')
      .flush({ message: 'Greška pri slanju email poruke.' }, { status: 500, statusText: 'Error' });
    expect(page.errorMessage).toBe('Greška pri slanju email poruke.');
    expect(page.statusMessage).toBe('');
    expect(page.submitting).toBeFalse();
  });
});
