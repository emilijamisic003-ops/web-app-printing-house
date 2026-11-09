import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ClientProfile } from './client-profile';
import { OrderService } from '../../services/order.service';
import { of } from 'rxjs';

describe('ClientProfile', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: OrderService, useValue: { getOrdersByClient: () => of([]) } }]
    });
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ username: 'ana.client', firstName: 'Staro ime' }));
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const user = { username: 'ana.client', firstName: 'Ana', lastName: 'Anić', phone: '0601234567',
    email: 'ana@example.com', profileImage: '', clientType: 'individual' };

  it('loads current data from the backend on init and displays all common fields', () => {
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Učitavanje profila');
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/ana.client');
    expect(request.request.method).toBe('GET');
    request.flush(user);
    fixture.detectChanges();
    for (const value of [user.username, user.firstName, user.lastName, user.phone, user.email, 'Fizičko lice']) {
      expect(page.textContent).toContain(value);
    }
    expect(page.textContent).not.toContain('Staro ime');
    expect(page.querySelector<HTMLInputElement>('#edit-firstName')?.value).toBe('Ana');
    expect(page.querySelector('input[formControlName="username"]')).toBeNull();
    expect(page.querySelector('#edit-institutionName')).toBeNull();
    expect(fixture.componentInstance.loading).toBeFalse();
  });

  it('displays legal entity fields and handles unavailable images', () => {
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/ana.client').flush({
      ...user, clientType: 'legal', institutionName: 'Firma', address: 'Beograd',
      registrationNumber: '01234567', pib: '123456789', profileImage: 'slika.png'
    });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    for (const text of ['Pravno lice', 'Firma', 'Beograd', '01234567', '123456789']) {
      expect(page.textContent).toContain(text);
    }
    expect(page.querySelector('img')?.getAttribute('src')).toBe('slika.png');
    page.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(page.querySelector('img')?.getAttribute('src')).toBe('/images/profiles/default_profile_image.jpg');
    page.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(page.querySelector('img')).toBeNull();
    expect(page.textContent).toContain('Slika trenutno nije dostupna');
  });

  it('shows backend errors and a fallback for network failures', () => {
    for (const status of [404, 500, 0]) {
      const fixture = TestBed.createComponent(ClientProfile);
      fixture.detectChanges();
      const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/ana.client');
      if (status) {
        request.flush({ message: 'Poruka sa servera' }, { status, statusText: 'Error' });
      } else {
        request.error(new ProgressEvent('error'));
      }
      fixture.detectChanges();
      expect(fixture.componentInstance.loading).toBeFalse();
      expect(fixture.componentInstance.user).toBeNull();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
        .toContain(status ? 'Poruka sa servera' : 'Profil trenutno nije moguće učitati');
      fixture.destroy();
    }
  });

  it('does not make a request for missing or malformed stored user data', () => {
    for (const value of [null, '{broken', 'null', '{}']) {
      (localStorage.getItem as jasmine.Spy).and.returnValue(value);
      const fixture = TestBed.createComponent(ClientProfile);
      fixture.detectChanges();
      expect(fixture.componentInstance.errorMessage).not.toBe('');
      TestBed.inject(HttpTestingController).expectNone(request => request.url.includes('/users/'));
      fixture.destroy();
    }
  });

  it('encodes special characters in the username as a single URL parameter', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify({ username: 'ana/test?' }));
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/ana%2Ftest%3F').flush(user);
    expect(fixture.componentInstance.user).toEqual(user);
  });

  it('sends only editable fields and uses the updated response to refill the form and display', () => {
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/users/ana.client').flush(user);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ firstName: 'Novo ime', email: 'novo@example.com' });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    component.save();
    const request = http.expectOne('http://localhost:4000/users/ana.client');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ firstName: 'Novo ime', lastName: user.lastName,
      phone: user.phone, email: 'novo@example.com' });
    const updated = { ...user, firstName: 'Sačuvano ime', email: 'novo@example.com' };
    request.flush(updated);
    fixture.detectChanges();
    expect(component.user).toEqual(updated);
    expect(component.form.controls.firstName.value).toBe('Sačuvano ime');
    expect(fixture.nativeElement.textContent).toContain('Sačuvano ime');
    expect(component.successMessage).toBe('Profil je uspešno ažuriran.');
    expect(component.saving).toBeFalse();
  });

  it('validates legal fields, includes them in PUT and preserves edits on an error', () => {
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const legal = { ...user, clientType: 'legal', institutionName: 'Firma', address: 'Beograd',
      registrationNumber: '01234567', pib: '123456789' };
    http.expectOne('http://localhost:4000/users/ana.client').flush(legal);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ pib: '012345678', email: 'invalid' });
    component.save();
    http.expectNone(request => request.method === 'PUT');
    expect(component.error('pib')).not.toBe('');
    expect(component.error('email')).not.toBe('');
    component.form.patchValue({ pib: '123456789', email: user.email, institutionName: 'Nova firma' });
    component.save();
    const request = http.expectOne('http://localhost:4000/users/ana.client');
    expect(request.request.body.institutionName).toBe('Nova firma');
    expect(request.request.body.address).toBe('Beograd');
    expect(request.request.body.registrationNumber).toBe('01234567');
    expect(request.request.body.pib).toBe('123456789');
    expect(request.request.body.username).toBeUndefined();
    expect(request.request.body.profileImage).toBeUndefined();
    request.flush({ message: 'Neispravni podaci.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(component.saveError).toBe('Neispravni podaci.');
    expect(component.form.controls.institutionName.value).toBe('Nova firma');
    expect(component.user).toEqual(legal);
    expect(component.saving).toBeFalse();
  });
});
