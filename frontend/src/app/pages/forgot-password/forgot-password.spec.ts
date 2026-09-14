import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('requires an identifier and accepts either username or email without claiming an email was sent', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const form = page.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(page.querySelector('#identifier-error')?.textContent).toContain('Unesite');
    expect(fixture.componentInstance.form.invalid).toBeTrue();

    const input = page.querySelector<HTMLInputElement>('#identifier')!;
    for (const value of ['klijent', 'klijent@example.com']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.statusMessage).toBe('');
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.form.valid).toBeTrue();
      expect(page.querySelector('#identifier-error')?.textContent?.trim()).toBe('');
      expect(page.querySelector('.status')?.textContent).toContain('Email nije poslat');
    }
  });
});
