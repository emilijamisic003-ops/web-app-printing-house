import { TestBed } from '@angular/core/testing';
import { LoginForm } from './login-form';
import { provideRouter } from '@angular/router';

describe('LoginForm', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('shows required-field errors after submitting an empty form', () => {
    const fixture = TestBed.createComponent(LoginForm);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(page.querySelector('#username-error')?.textContent).toContain('Unesite korisničko ime');
    expect(page.querySelector('#password-error')?.textContent).toContain('Unesite lozinku');
    expect(fixture.componentInstance.submitted).toBeFalse();
  });

  it('only displays an unavailable notice for a valid form', () => {
    const fixture = TestBed.createComponent(LoginForm);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [['username', 'klijent'], ['password', 'primer']]) {
      const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.form.valid).toBeTrue();
    expect(page.querySelector('.status')?.textContent).toContain('Niste prijavljeni u sistem');
  });
});
