import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let route: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };
  beforeEach(() => {
    route = { snapshot: { queryParamMap: convertToParamMap({ token: 'test-token' }) } };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: route }] });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('validates required fields, password rules and matching', () => {
    const page = TestBed.createComponent(ResetPassword).componentInstance;
    page.submit();
    expect(page.error('newPassword')).toContain('Unesite');
    expect(page.error('confirmPassword')).toContain('Ponovite');
    for (const value of ['Abcde1!', 'Abcdefghijk1!', '1Abcdef!', 'abcdef1!', 'Abcdefg!', 'Abcdef12']) {
      page.form.setValue({ newPassword: value, confirmPassword: value });
      expect(page.form.invalid).withContext(value).toBeTrue();
    }
    for (const value of ['Abcdef1!', 'Abcdefghij1!', 'Čbcdef1!']) {
      page.form.setValue({ newPassword: value, confirmPassword: value });
      expect(page.form.valid).withContext(value).toBeTrue();
    }
    page.form.controls.confirmPassword.setValue('Different1!');
    expect(page.form.hasError('passwordMismatch')).toBeTrue();
    page.submit();
    TestBed.inject(HttpTestingController).expectNone('http://localhost:4000/users/reset-password');
  });

  it('shows missing token immediately and does not submit', () => {
    route.snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Link nije ispravan.');
    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController).expectNone('http://localhost:4000/users/reset-password');
  });

  it('posts URL token and password, then disables further submissions', () => {
    const page = TestBed.createComponent(ResetPassword).componentInstance;
    page.form.setValue({ newPassword: 'Primer1!', confirmPassword: 'Primer1!' });
    page.submit(); page.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/reset-password');
    expect(request.request.body).toEqual({ token: 'test-token', password: 'Primer1!' });
    request.flush({ message: 'Lozinka je uspešno promenjena.' });
    expect(page.completed).toBeTrue();
    expect(page.statusMessage).toBe('Lozinka je uspešno promenjena.');
    page.submit();
    TestBed.inject(HttpTestingController).expectNone('http://localhost:4000/users/reset-password');
  });

  it('shows the expired-token error from the backend', () => {
    const page = TestBed.createComponent(ResetPassword).componentInstance;
    page.form.setValue({ newPassword: 'Primer1!', confirmPassword: 'Primer1!' });
    page.submit();
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/reset-password')
      .flush({ message: 'Link nije ispravan ili je istekao.' }, { status: 400, statusText: 'Bad request' });
    expect(page.errorMessage).toBe('Link nije ispravan ili je istekao.');
    expect(page.completed).toBeFalse();
    expect(page.submitting).toBeFalse();
  });
});
