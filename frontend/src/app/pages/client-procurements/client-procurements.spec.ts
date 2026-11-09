import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { ClientProcurements } from './client-procurements';
import { PrinterProcurements } from '../printer-procurements/printer-procurements';
import { Cart } from '../cart/cart';
import { CartItem } from '../../services/cart.service';
import { Procurement } from '../../services/procurement.service';

const procurement: Procurement = { _id: '1', procurementId: 'JN-1', clientUsername: 'firma', status: 'active', offers: [],
  createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(),
  items: [{ productCode: 'A', productName: 'Majica', quantity: 2 }, { productCode: 'A', productName: 'Majica', quantity: 3 }, { productCode: 'B', productName: 'Šolja', quantity: 4 }] };

describe('Whole-cart procurements', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ username: 'firma', role: 'client', clientType: 'legal' }));
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('displays all requested items without a manual creation form and countdown performs no write', fakeAsync(() => {
    const fixture = TestBed.createComponent(ClientProcurements); fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/procurements/client/firma').flush([{ ...procurement, expiresAt: new Date(Date.now() + 1000).toISOString() }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Majica');
    expect(fixture.nativeElement.textContent).toContain('Šolja');
    tick(1000); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Istekla');
    http.expectNone(() => true);
    fixture.componentInstance.refresh();
    http.expectOne('http://localhost:4000/procurements/client/firma').flush([{ ...procurement, status: 'finished' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nije pronađena validna ponuda.');
    fixture.destroy();
  }));
  it('legal confirmation sends only username and navigates with the email warning, without orders', () => {
    const fixture = TestBed.createComponent(Cart);
    const component = fixture.componentInstance;
    component.items = [{ productCode: 'A', quantity: 2 } as CartItem];
    const navigation = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.confirm(); component.confirm();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('http://localhost:4000/procurements/confirm');
    expect(request.request.body).toEqual({ clientUsername: 'firma' });
    request.flush({ message: 'Javna nabavka je uspešno raspisana.', warning: 'Email nije poslat.', procurement });
    expect(component.items).toEqual([]);
    expect(navigation).toHaveBeenCalledWith(['/client/procurements'], { state: { successMessage: 'Javna nabavka je uspešno raspisana.', warning: 'Email nije poslat.' } });
    http.expectNone(request => request.url.includes('/orders/'));
    http.expectNone(request => request.method === 'DELETE');
    fixture.destroy();
  });
  it('individual client retains the existing order and cart-clear calls', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify({ username: 'ana', role: 'client', clientType: 'individual' }));
    const fixture = TestBed.createComponent(Cart);
    fixture.componentInstance.items = [{ productCode: 'A', quantity: 2 } as CartItem];
    fixture.componentInstance.confirm();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/orders/confirm').flush({ warning: '' });
    http.expectNone('http://localhost:4000/carts/ana');
    expect(fixture.componentInstance.items).toEqual([]);
    http.expectNone(request => request.url.includes('/procurements'));
    fixture.destroy();
  });
  it('printer form sends one total offer and closes after success', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify({ username: 'printer', role: 'printer' }));
    const fixture = TestBed.createComponent(PrinterProcurements); fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(request => request.url.endsWith('/procurements/active/printer/printer')).flush([procurement]);
    const component = fixture.componentInstance;
    component.open(component.procurements[0]);
    component.submit(); http.expectNone(request => request.method === 'POST');
    component.form.controls.totalPrice.setValue(0);
    component.submit(); http.expectNone(request => request.method === 'POST');
    component.form.controls.totalPrice.setValue(22);
    component.submit(); component.submit();
    const request = http.expectOne('http://localhost:4000/procurements/JN-1/offers');
    expect(request.request.body).toEqual({ printingHouseUsername: 'printer', totalPrice: 22 });
    request.flush({});
    expect(component.procurements[0].hasOffer).toBeTrue();
    expect(component.selected).toBeNull();
    fixture.destroy();
  });
});
