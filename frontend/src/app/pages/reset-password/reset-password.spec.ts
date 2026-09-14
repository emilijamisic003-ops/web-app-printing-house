import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('shows required errors below both fields on submit', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(page.querySelector('#new-password-error')?.textContent).toContain('Unesite novu lozinku');
    expect(page.querySelector('#confirm-password-error')?.textContent).toContain('Ponovite novu lozinku');
    expect(fixture.componentInstance.form.invalid).toBeTrue();
    expect(fixture.componentInstance.statusMessage).toBe('');
  });

  it('rejects matching passwords that violate the password rules', () => {
    const component = TestBed.createComponent(ResetPassword).componentInstance;
    for (const value of ['Abcde1!', 'Abcdefghijk1!', '1Abcdef!', 'abcdef1!', 'Abcdefg!', 'Abcdef12']) {
      component.form.setValue({ newPassword: value, confirmPassword: value });
      expect(component.form.invalid).withContext(value).toBeTrue();
    }
    for (const value of ['Abcdef1!', 'Abcdefghij1!', 'Čbcdef1!']) {
      component.form.setValue({ newPassword: value, confirmPassword: value });
      expect(component.form.valid).withContext(value).toBeTrue();
    }
  });

  it('revalidates matching when either field changes and preserves required validation', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const page = fixture.nativeElement as HTMLElement;
    function enter(id: string, value: string) {
      const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    }
    enter('new-password', 'Primer1!');
    enter('confirm-password', 'Primer2!');
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
    expect(page.querySelector('#confirm-password-error')?.textContent).toContain('ne podudaraju');
    enter('confirm-password', 'Primer1!');
    expect(component.form.valid).toBeTrue();
    component.submit();
    expect(component.statusMessage).toContain('Lozinka nije promenjena');
    enter('new-password', 'Primer3!');
    expect(component.statusMessage).toBe('');
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
    enter('confirm-password', '');
    expect(component.form.hasError('passwordMismatch')).toBeFalse();
    expect(component.form.controls.confirmPassword.hasError('required')).toBeTrue();
  });
});
