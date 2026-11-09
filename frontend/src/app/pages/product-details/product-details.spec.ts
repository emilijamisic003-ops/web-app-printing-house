import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ProductDetails } from './product-details';

describe('ProductDetails', () => {
  let previousUser: string | null;
  let previousCart: string | null;
  beforeEach(() => {
    previousUser = localStorage.getItem('currentUser');
    previousCart = localStorage.getItem('cart');
    localStorage.removeItem('cart');
    localStorage.removeItem('currentUser');
  });
  afterEach(() => {
    if (previousCart === null) localStorage.removeItem('cart');
    else localStorage.setItem('cart', previousCart);
    if (previousUser === null) localStorage.removeItem('currentUser');
    else localStorage.setItem('currentUser', previousUser);
  });
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(),
      provideRouter([{ path: 'products/:printingHouseUsername/:code', component: ProductDetails }, { path: 'products/:code', component: ProductDetails }])]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows client choices, validates quantity and saves the calculated configuration', async () => {
    localStorage.setItem('currentUser', JSON.stringify({ username: 'ana', role: 'client' }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products/M001', ProductDetails);
    const service = { serviceId: 's1', printType: 'Sito štampa', additionalPricePerItem: 50 };
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/products/M001').flush({
      code: 'M001', name: 'Majica', printingHouseUsername: 'stampaj', unitPrice: 100, stock: 5,
      colors: ['Bela', 'Crna'], printServices: [service], mainImage: ''
    });
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/users/printer/stampaj')
      .flush({ username: 'stampaj' });
    TestBed.inject(HttpTestingController).expectOne(req => req.url === 'http://localhost:4000/comments/product/M001')
      .flush([]);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Cena po komadu:');
    expect(harness.routeNativeElement?.textContent).toContain('Sito štampa');
    const color = harness.routeNativeElement!.querySelector('#color') as HTMLSelectElement;
    color.value = 'Crna';
    color.dispatchEvent(new Event('change'));
    page.configurationForm.controls.quantity.setValue(3);
    expect(page.totalPrice).toBe(450);
    page.next();
    expect(page.selectedConfiguration).toEqual({ productCode: 'M001', quantity: 3,
      selectedColor: 'Crna', selectedPrintService: service, printText: '', totalPrice: 450 });
    const add = TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/carts/ana/items');
    expect(add.request.body).toEqual({ ...page.selectedConfiguration, productName: 'Majica', printingHouseUsername: 'stampaj', unitPrice: 100 });
    add.flush({ items: [add.request.body] });
    expect(page.cartMessage).toBe('Proizvod je dodat u korpu.');
    for (const quantity of [null, 0, 6, 1.5]) {
      page.configurationForm.controls.quantity.setValue(quantity);
      page.next();
      expect(page.selectedConfiguration).toBeNull();
      expect(page.configurationForm.controls.quantity.invalid).toBeTrue();
    }
    page.configurationForm.controls.quantity.setValue(5);
    TestBed.inject(HttpTestingController).expectNone('http://localhost:4000/carts/ana/items');
    expect(page.configurationForm.valid).toBeTrue();
  });

  it('keeps optional print text and does not display a print image input', async () => {
    localStorage.setItem('currentUser', JSON.stringify({ username: 'ana', role: 'client' }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products/M001', ProductDetails);
    TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/products/M001').flush({
      code: 'M001', unitPrice: 100, stock: 5, colors: [], printServices: []
    });
    TestBed.inject(HttpTestingController).expectOne(req => req.url === 'http://localhost:4000/comments/product/M001')
      .flush([]);
    harness.detectChanges();
    page.configurationForm.controls.printText.setValue('ETF');
    page.next();
    expect(page.selectedConfiguration?.printText).toBe('ETF');
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/carts/ana/items');
    expect(request.request.body.printImageName).toBeUndefined();
    request.flush({ items: [request.request.body] });
    expect(harness.routeNativeElement?.querySelector('input[type="file"]')).toBeNull();
  });

  it('handles unavailable colors, print services and zero stock', async () => {
    localStorage.setItem('currentUser', JSON.stringify({ username: 'ana', role: 'client' }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products/M001', ProductDetails);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/products/M001').flush({
      code: 'M001', unitPrice: 100, stock: 5, colors: [], printServices: []
    });
    http.expectOne(req => req.url === 'http://localhost:4000/comments/product/M001').flush([]);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Nema dostupnih boja');
    expect(harness.routeNativeElement?.textContent).toContain('Nema dostupnih usluga štampe');
    expect(page.totalPrice).toBe(100);
    await harness.navigateByUrl('/products/M002', ProductDetails);
    http.expectOne('http://localhost:4000/products/M002').flush({ code: 'M002', printingHouseUsername: '', unitPrice: 100, stock: 0 });
    http.expectOne(req => req.url === 'http://localhost:4000/comments/product/M002').flush([]);
    page.next();
    expect(page.selectedConfiguration).toBeNull();
  });

  for (const stored of [null, '{bad', JSON.stringify({ role: 'printer' }), JSON.stringify({ role: 'admin' })]) {
    it('keeps client fields hidden for stored user: ' + stored, async () => {
      if (stored === null) localStorage.removeItem('currentUser');
      else localStorage.setItem('currentUser', stored);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/products/M001', ProductDetails);
      TestBed.inject(HttpTestingController).expectOne('http://localhost:4000/products/M001')
        .flush({ code: 'M001', printingHouseUsername: '', name: 'Majica', unitPrice: 100, stock: 5, colors: ['Bela'], printServices: [] });
      TestBed.inject(HttpTestingController).expectOne(req => req.url === 'http://localhost:4000/comments/product/M001').flush([]);
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Majica');
      expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    });
  }

  it('loads the code from the URL, displays data and handles missing images', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products/M001', ProductDetails);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('http://localhost:4000/products/M001');
    expect(request.request.method).toBe('GET');
    request.flush({ code: 'M001', name: 'Majica', printingHouseUsername: 'stampaj', category: 'Pokloni',
      subcategory: 'Odeća', likes: 8, dislikes: 1, mainImage: '', additionalImages: ['extra.png'] });
    http.expectOne(req => req.url === 'http://localhost:4000/comments/product/M001').flush([]);
    http.expectOne('http://localhost:4000/users/printer/stampaj').flush({ username: 'stampaj' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Majica');
    expect(harness.routeNativeElement?.textContent).toContain('stampaj');
    expect(harness.routeNativeElement?.textContent).toContain('M001');
    expect(harness.routeNativeElement!.querySelectorAll('img').length).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('Slika nije dostupna');

    await harness.navigateByUrl('/products/M002', ProductDetails);
    http.expectOne('http://localhost:4000/products/M002').flush({ code: 'M002', printingHouseUsername: '', name: 'Šolja',
      mainImage: 'main.png', additionalImages: ['extra.png'] });
    http.expectOne(req => req.url === 'http://localhost:4000/comments/product/M002').flush([]);
    harness.detectChanges();
    const images = harness.routeNativeElement!.querySelectorAll('img');
    expect(images.length).toBe(1);
    expect(images[0].getAttribute('src')).toBe('main.png');
    images.forEach(image => image.dispatchEvent(new Event('error')));
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Slika nije dostupna');
  });

  it('loads printer details after the product and keeps the product visible on printer errors', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products/M001', ProductDetails);
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(req => req.url.includes('/users/printer/'));
    http.expectOne('http://localhost:4000/products/M001').flush({
      code: 'M001', name: 'Majica', printingHouseUsername: 'copy.studio'
    });
    http.expectOne(req => req.url === 'http://localhost:4000/comments/product/M001').flush([]);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Majica');
    expect(harness.routeNativeElement?.textContent).toContain('copy.studio');
    const request = http.expectOne('http://localhost:4000/users/printer/copy.studio');
    expect(request.request.method).toBe('GET');
    request.flush({ username: 'copy.studio', institutionName: 'Copy Studio', address: 'Beograd' });
    harness.detectChanges();
    expect(page.printer?.institutionName).toBe('Copy Studio');
    expect(harness.routeNativeElement?.textContent).toContain('Copy Studio');
    expect(harness.routeNativeElement?.textContent).toContain('Beograd');

    await harness.navigateByUrl('/products/M002', ProductDetails);
    expect(page.printer).toBeNull();
    http.expectOne('http://localhost:4000/products/M002').flush({
      code: 'M002', name: 'Šolja', printingHouseUsername: 'print.house'
    });
    http.expectOne(req => req.url === 'http://localhost:4000/comments/product/M002').flush([]);
    http.expectOne('http://localhost:4000/users/printer/print.house')
      .flush({}, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Šolja');
    expect(harness.routeNativeElement?.textContent).toContain('print.house');
    expect(page.errorMessage).toBe('');
    expect(page.loading).toBeFalse();
  });

  it('shows friendly messages for missing products and server errors', async () => {
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    for (const status of [404, 500]) {
      await harness.navigateByUrl('/products/' + status, ProductDetails);
      http.expectOne('http://localhost:4000/products/' + status)
        .flush({}, { status, statusText: 'Error' });
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain(status === 404
        ? 'Proizvod nije pronađen' : 'Proizvod trenutno nije dostupan.');
    }
  });
});

describe('Printer-specific product details', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([
      { path: 'products/:printingHouseUsername/:code', component: ProductDetails }
    ])]
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reloads the same product code for a different printer and scopes comments', async () => {
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    for (const printer of ['first', 'second']) {
      const page = await harness.navigateByUrl('/products/' + printer + '/SAME', ProductDetails);
      const request = http.expectOne(req => req.url === 'http://localhost:4000/products/SAME');
      expect(request.request.params.get('printingHouseUsername')).toBe(printer);
      request.flush({ code: 'SAME', name: printer + ' product', printingHouseUsername: printer,
        stock: 2, unitPrice: 10, colors: [], printServices: [], mainImage: '/images/products/test.png' });
      const comments = http.expectOne(req => req.url === 'http://localhost:4000/comments/product/SAME');
      expect(comments.request.params.get('printingHouseUsername')).toBe(printer);
      comments.flush([]);
      http.expectOne('http://localhost:4000/users/printer/' + printer).flush({ username: printer });
      harness.detectChanges();
      expect(page.product?.printingHouseUsername).toBe(printer);
      expect(harness.routeNativeElement?.querySelector('img')?.getAttribute('src'))
        .toBe('http://localhost:4000/images/products/test.png');
    }
  });
});
