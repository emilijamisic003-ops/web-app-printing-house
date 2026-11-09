import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Register } from './register';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('Register', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup() {
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, page: fixture.nativeElement as HTMLElement };
  }

  function fillCommon(component: Register) {
    component.form.patchValue({ username: 'klijent', password: 'Primer1!', firstName: 'Ana',
      lastName: 'Anić', phone: '0601234567', email: 'ana@example.com' });
  }

  it('shows required errors on submit and accepts a complete individual form without an image', () => {
    const { fixture, component, page } = setup();
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(page.querySelector('#username-error')?.textContent).toContain('obavezno');
    expect(page.querySelector('#email-error')?.textContent).toContain('obavezno');
    expect(component.form.valid).toBeFalse();
    TestBed.inject(HttpTestingController).expectNone('http://localhost:4000/users/register');
    fillCommon(component);
    expect(component.form.valid).toBeTrue();
    component.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/register');
    expect(request.request.method).toBe('POST');
    expect(Object.fromEntries((request.request.body as FormData).entries())).toEqual({ username: 'klijent', password: 'Primer1!', firstName: 'Ana',
      lastName: 'Anić', phone: '0601234567', email: 'ana@example.com',
      role: 'client', clientType: 'individual' });
    request.flush({ message: 'OK' }, { status: 201, statusText: 'Created' });
    expect(component.statusMessage).toBe('Zahtev za registraciju je uspešno poslat.');
    expect(component.isSubmitting).toBeFalse();
  });

  it('enables and shows institution fields for both business types and excludes them for individuals', () => {
    const { fixture, component, page } = setup();
    fillCommon(component);
    const select = page.querySelector<HTMLSelectElement>('#account-type')!;
    for (const type of ['legal', 'printing']) {
      select.value = type;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(page.querySelector('#institution-name')).not.toBeNull();
      expect(component.form.controls.institution.enabled).toBeTrue();
      expect(component.form.valid).toBeFalse();
    }
    component.form.controls.institution.setValue({ name: 'Firma', address: 'Beograd', registrationNumber: '01234567', pib: '123456789' });
    expect(component.form.valid).toBeTrue();
    component.form.controls.institution.controls.pib.setValue('0');
    select.value = 'individual';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(page.querySelector('#institution-name')).toBeNull();
    expect(component.form.valid).toBeTrue();
    expect(component.form.value.institution).toBeUndefined();
  });

  it('enforces every password constraint, including length boundaries', () => {
    const { component } = setup();
    const password = component.form.controls.password;
    for (const value of ['', 'Abcde1!', 'Abcdefghijk1!', '1Abcdef!', 'abcdef1!', 'Abcdefg!', 'Abcdef12']) {
      password.setValue(value);
      expect(password.invalid).withContext(value).toBeTrue();
    }
    for (const value of ['Abcdef1!', 'Abcdefghij1!', 'Čbcdef1!']) {
      password.setValue(value);
      expect(password.valid).withContext(value).toBeTrue();
    }
  });

  it('maps institution data for legal clients and printers and shows backend errors', () => {
    const { component } = setup();
    fillCommon(component);
    const http = TestBed.inject(HttpTestingController);
    for (const type of ['legal', 'printing'] as const) {
      component.form.controls.accountType.setValue(type);
      component.form.controls.institution.setValue({ name: 'Firma', address: 'Beograd', registrationNumber: '01234567', pib: '123456789' });
      component.form.controls.profileImage.setValue(new File(['test'], 'slika.png', { type: 'image/png' }));
      component.submit();
      component.submit();
      const request = http.expectOne('http://localhost:4000/users/register');
      expect(request.request.body.get('role')).toBe(type === 'printing' ? 'printer' : 'client');
      expect(request.request.body.get('clientType')).toBe(type === 'printing' ? null : 'legal');
      expect(request.request.body.get('institutionName')).toBe('Firma');
      expect(request.request.body.get('address')).toBe('Beograd');
      expect(request.request.body.get('registrationNumber')).toBe('01234567');
      expect(request.request.body.get('pib')).toBe('123456789');
      expect(request.request.body.get('profileImage')).toBe(component.form.controls.profileImage.value);
      expect(request.request.body.get('institution')).toBeNull();
      request.flush({ message: 'Email adresa već postoji.' }, { status: 400, statusText: 'Bad Request' });
      expect(component.errorMessage).toBe('Email adresa već postoji.');
      expect(component.isSubmitting).toBeFalse();
      expect(component.statusMessage).toBe('');
    }
    component.form.controls.accountType.setValue('individual');
    component.submit();
    const request = http.expectOne('http://localhost:4000/users/register');
    expect(request.request.body.get('institutionName')).toBeNull();
    expect(request.request.body.get('pib')).toBeNull();
    request.error(new ProgressEvent('error'));
    expect(component.errorMessage).toContain('Registracija trenutno nije moguća');
    expect(component.isSubmitting).toBeFalse();
  });

  it('validates email, registration number and PIB as strings of the required format', () => {
    const { component } = setup();
    component.form.controls.email.setValue('neispravan-email');
    expect(component.form.controls.email.hasError('email')).toBeTrue();
    component.form.controls.accountType.setValue('legal');
    const { registrationNumber, pib } = component.form.controls.institution.controls;
    for (const value of ['', '1234567', '123456789', '1234567a']) {
      registrationNumber.setValue(value);
      expect(registrationNumber.invalid).toBeTrue();
    }
    registrationNumber.setValue('01234567');
    expect(registrationNumber.valid).toBeTrue();
    for (const value of ['', '012345678', '12345678', '1234567890', '12345678a']) {
      pib.setValue(value);
      expect(pib.invalid).toBeTrue();
    }
    pib.setValue('123456789');
    expect(pib.valid).toBeTrue();
  });

  it('validates selected image types, shows the filename and recovers after reselection', () => {
    const { fixture, component, page } = setup();
    const input = page.querySelector<HTMLInputElement>('#profile-image')!;
    for (const [name, type, valid] of [
      ['file.pdf', 'application/pdf', false], ['fake.png', 'text/plain', false],
      ['slika.JPG', 'image/jpeg', true], ['slika.png', 'image/png', true], ['slika.gif', 'image/gif', true]
    ] as const) {
      const data = new DataTransfer();
      data.items.add(new File(['test'], name, { type }));
      input.files = data.files;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(component.form.controls.profileImage.valid).toBe(valid);
      expect(page.querySelector('#image-name')?.textContent).toContain(name);
      if (!valid) expect(page.querySelector('#image-error')?.textContent).toContain('JPG, PNG ili GIF');
    }
    fillCommon(component);
    component.form.controls.profileImage.setValue(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
    component.submit();
    expect(component.error('profileImage')).toContain('5 MB');
    TestBed.inject(HttpTestingController).expectNone('http://localhost:4000/users/register');
    input.files = new DataTransfer().files;
    input.dispatchEvent(new Event('change'));
    expect(component.form.controls.profileImage.value).toBeNull();
    expect(component.form.controls.profileImage.valid).toBeTrue();
  });
});
