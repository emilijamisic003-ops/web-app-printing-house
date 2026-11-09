import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Cart } from './cart';
import { CartItem, CartService } from '../../services/cart.service';
import { UserService } from '../../services/user.service';

// The cart is stored by the backend; localStorage only identifies the client.
describe('Cart', () => {
  const url = 'http://localhost:4000/carts/ana.client';
  const item: CartItem = { productCode: 'M001', productName: 'Majica', printingHouseUsername: 'copy.studio',
    quantity: 2, selectedColor: 'Bela', selectedPrintService: null, printText: 'ETF', unitPrice: 100, totalPrice: 200 };

  beforeEach(() => {
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ username: 'ana.client', role: 'client', clientType: 'individual' }));
    TestBed.configureTestingModule({ imports: [Cart], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: UserService, useValue: { getPrinterByUsername: (username: string) => of({ username }) } }] });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(items: CartItem[]) {
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne({ method: 'GET', url }).flush({ clientUsername: 'ana.client', items });
    fixture.detectChanges();
    return { fixture, http, component: fixture.componentInstance };
  }

  it('posts configured items to the backend', () => {
    let saved: CartItem[] = [];
    TestBed.inject(CartService).addItem(item).subscribe(cart => saved = cart.items);
    const request = TestBed.inject(HttpTestingController).expectOne({ method: 'POST', url: url + '/items' });
    expect(request.request.body).toEqual(item);
    request.flush({ clientUsername: 'ana.client', items: [item] });
    expect(saved).toEqual([item]);
  });

  it('groups interleaved products and removes by the original cart index', () => {
    const other = { ...item, printingHouseUsername: 'print.house', totalPrice: 100 };
    const duplicate = { ...item, selectedColor: 'Crna', totalPrice: 300 };
    const { fixture, http, component } = setup([item, other, duplicate]);
    expect(component.groups.map(group => group.subtotal)).toEqual([500, 100]);
    expect(component.totalPrice).toBe(600);
    fixture.nativeElement.querySelectorAll('article button')[1].click();
    http.expectOne({ method: 'DELETE', url: url + '/items/2' }).flush({ items: [item, other] });
    fixture.detectChanges();
    expect(component.items).toEqual([item, other]);
    expect(component.totalPrice).toBe(300);
    component.removeItem(1);
    http.expectOne({ method: 'DELETE', url: url + '/items/1' }).flush({ items: [item] });
    expect(component.groups.length).toBe(1);
    component.removeItem(0);
    http.expectOne({ method: 'DELETE', url: url + '/items/0' }).flush({ items: [] });
    fixture.detectChanges();
    expect(component.totalPrice).toBe(0);
    expect(component.groups).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Korpa je prazna.');
  });

  for (const warning of ['', 'PDF fakture nisu generisane.']) {
    it('confirms once and clears the backend cart with warning: ' + warning, () => {
      const { fixture, http, component } = setup([item]);
      component.confirm();
      component.confirm();
      component.removeItem(0);
      const request = http.expectOne('http://localhost:4000/orders/confirm');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ clientUsername: 'ana.client', items: [item] });
      request.flush({ orders: [], warning });
      http.expectNone({ method: 'DELETE', url });
      fixture.detectChanges();
      expect(component.items).toEqual([]);
      expect(component.confirming).toBeFalse();
      expect(fixture.nativeElement.querySelector('.confirm-button')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Narudžbina je uspešno kreirana.');
      expect(component.warningMessage).toBe(warning);
    });
  }

  it('preserves items when confirmation or removal fails', () => {
    const { http, component } = setup([item]);
    for (const status of [400, 500]) {
      component.confirm();
      http.expectOne('http://localhost:4000/orders/confirm').flush({ message: 'Greška' }, { status, statusText: 'Error' });
      expect(component.items).toEqual([item]);
      expect(component.errorMessage).toBe('Greška');
      expect(component.confirming).toBeFalse();
    }
    component.removeItem(0);
    http.expectOne({ method: 'DELETE', url: url + '/items/0' }).flush({}, { status: 500, statusText: 'Error' });
    expect(component.items).toEqual([item]);
    expect(component.errorMessage).not.toBe('');
  });
});
