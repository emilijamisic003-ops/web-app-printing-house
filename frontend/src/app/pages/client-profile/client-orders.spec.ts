import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClientProfile } from './client-profile';

describe('Client profile orders', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ username: 'ana.client', role: 'client' }));
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const user = { username: 'ana.client', firstName: 'Ana', lastName: 'Anić', phone: '060123',
    email: 'ana@example.com', profileImage: '', clientType: 'individual' };
  const order = { _id: '1', invoiceId: 'INV-001', clientUsername: 'ana.client', printingHouseUsername: 'copy.studio',
    items: [{ productCode: 'M001', productName: 'Majica', quantity: 2 }], totalPrice: 400,
    status: 'naručeno', createdAt: '2026-09-15T10:00:00Z' };

  function setup() {
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/users/ana.client').flush(user);
    return { fixture, http, component: fixture.componentInstance };
  }

  it('shows legal-client procurement orders without a cancellation button', () => {
    const fixture = TestBed.createComponent(ClientProfile);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/users/ana.client').flush({ ...user, clientType: 'legal' });
    http.expectOne('http://localhost:4000/orders/client/ana.client').flush([{ ...order, status: 'u štampi' }]);
    http.expectOne('http://localhost:4000/users/printer/copy.studio').flush({ username: 'copy.studio' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Moje porudžbine');
    expect(fixture.nativeElement.textContent).toContain('u štampi');
    expect(fixture.nativeElement.querySelectorAll('td button').length).toBe(0);
    fixture.componentInstance.cancelOrder({ ...order, status: 'u štampi' });
    http.expectNone(req => req.method === 'PUT');
  });

  it('loads printer names once, sorts, cancels and updates the table', () => {
    const { fixture, http, component } = setup();
    const paid = { ...order, _id: '2', invoiceId: 'INV-002', totalPrice: 100,
      status: 'plaćeno', createdAt: '2026-09-14T10:00:00Z' };
    http.expectOne('http://localhost:4000/orders/client/ana.client').flush([order, paid]);
    http.expectOne('http://localhost:4000/users/printer/copy.studio')
      .flush({ username: 'copy.studio', institutionName: 'Copy Studio', address: 'Beograd' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Copy Studio');
    expect(fixture.nativeElement.textContent).toContain('Beograd');
    expect(fixture.nativeElement.querySelector('td ol').textContent).toContain('Majica (2)');
    expect(fixture.nativeElement.querySelectorAll('td button').length).toBe(1);
    for (const field of ['invoiceId', 'printingHouse', 'totalPrice', 'status', 'createdAt'] as const) {
      component.toggleSort(field);
      const direction = component.sortAscending;
      component.toggleSort(field);
      expect(component.sortAscending).toBe(!direction);
    }
    component.toggleSort('totalPrice');
    expect(component.orders.map(item => item.totalPrice)).toEqual([100, 400]);
    component.cancelOrder(paid);
    http.expectNone(req => req.method === 'PUT');
    component.cancelOrder(order);
    component.cancelOrder(order);
    const request = http.expectOne('http://localhost:4000/orders/INV-001/cancel');
    expect(request.request.method).toBe('PUT');
    request.flush({ ...order, status: 'otkazano' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('otkazano');
    expect(fixture.nativeElement.querySelectorAll('td button').length).toBe(0);
  });

  it('keeps profile visible on order failure and saves an editable image path', () => {
    const { fixture, http, component } = setup();
    http.expectOne('http://localhost:4000/orders/client/ana.client').flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana');
    expect(component.ordersError).not.toBe('');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(component.defaultProfileImage);
    component.form.controls.firstName.setValue('Nesačuvano ime');
    component.selectedProfileImage = new File(['image'], 'ana.png', { type: 'image/png' });
    component.uploadProfileImage();
    const request = http.expectOne('http://localhost:4000/users/ana.client/profile-image');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.body.get('profileImage').name).toBe('ana.png');
    request.flush({ message: 'Slika je sačuvana.', user: { ...user, profileImage: '/uploads/profiles/ana.png' } });
    expect(component.form.controls.firstName.value).toBe('Nesačuvano ime');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('http://localhost:4000/uploads/profiles/ana.png');
  });

  it('falls back to printer username and displays cancellation errors', () => {
    const { http, component } = setup();
    http.expectOne('http://localhost:4000/orders/client/ana.client').flush([order]);
    http.expectOne('http://localhost:4000/users/printer/copy.studio').flush({}, { status: 404, statusText: 'Not found' });
    expect(component.printerName('copy.studio')).toBe('copy.studio');
    component.cancelOrder(order);
    http.expectOne('http://localhost:4000/orders/INV-001/cancel').flush(
      { message: 'Porudžbina više ne može da se otkaže.' }, { status: 400, statusText: 'Bad request' });
    expect(component.cancelError).toBe('Porudžbina više ne može da se otkaže.');
    expect(component.orders[0].status).toBe('naručeno');
    expect(component.cancelling.size).toBe(0);
  });
});
