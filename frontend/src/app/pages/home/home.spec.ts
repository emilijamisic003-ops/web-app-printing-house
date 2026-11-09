import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Home } from './home';
import { provideRouter } from '@angular/router';

describe('Home', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('searches with optional filters and toggles name sorting', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/categories/getAll').flush([{ name: 'Pokloni' }]);
    http.expectOne('http://localhost:4000/users/printing-houses/count').flush({ count: 0 });
    http.expectOne('http://localhost:4000/products/getTop').flush([]);
    fixture.componentInstance.searchForm.patchValue({ name: ' majica ', category: 'Pokloni' });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne(req => req.url.endsWith('/products/search'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('name')).toBe('majica');
    expect(request.request.params.get('category')).toBe('Pokloni');
    expect(request.request.params.has('sort')).toBeFalse();
    request.flush([{ _id: '1', code: 'M001', name: 'Majica', category: 'Pokloni', subcategory: 'Odeća', unitPrice: 900, stock: 10, likes: 8 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Majica');
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Odeća');
    expect(fixture.nativeElement.querySelector('tbody button').disabled).toBeFalse();
    for (const sort of ['asc', 'desc']) {
      fixture.nativeElement.querySelector('.sort-button').click();
      const sorted = http.expectOne(req => req.url.endsWith('/products/search'));
      expect(sorted.request.params.get('sort')).toBe(sort);
      expect(sorted.request.params.get('name')).toBe('majica');
      sorted.flush([]);
      fixture.detectChanges();
    }
    expect(fixture.nativeElement.textContent).toContain('Nema proizvoda koji odgovaraju pretrazi.');
  });

  it('omits blank filters and displays search errors', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/categories/getAll').flush([], { status: 500, statusText: 'Error' });
    http.expectOne('http://localhost:4000/users/printing-houses/count').flush({ count: 0 });
    http.expectOne('http://localhost:4000/products/getTop').flush([]);
    fixture.componentInstance.searchForm.patchValue({ name: ' ', category: 'all' });
    fixture.componentInstance.search();
    const request = http.expectOne('http://localhost:4000/products/search');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pretraga trenutno nije dostupna.');
    expect(fixture.nativeElement.textContent).toContain('Kategorije trenutno nisu dostupne.');
  });

  it('loads and displays the count and top products', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Učitavanje proizvoda...');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/categories/getAll').flush([{ name: 'Pokloni' }]);
    http.expectOne({ method: 'GET', url: 'http://localhost:4000/users/printing-houses/count' })
      .flush({ count: 3 });
    http.expectOne({ method: 'GET', url: 'http://localhost:4000/products/getTop' })
      .flush(Array.from({ length: 5 }, (_, i) => ({
        _id: String(i), name: 'Proizvod ' + i, category: 'Pokloni', unitPrice: 1200, likes: 42 - i
      })));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('3');
    expect(fixture.nativeElement.querySelectorAll('.top-products li').length).toBe(5);
    const firstProduct = fixture.nativeElement.querySelector('.top-products li').textContent;
    expect(firstProduct).toContain('Proizvod 0');
    expect(firstProduct).toContain('Pokloni');
    expect(firstProduct).toContain('1200 RSD');
    expect(firstProduct).toContain('Sviđanja: 42');
  });

  it('displays zero and an empty product list', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/categories/getAll').flush([{ name: 'Pokloni' }]);
    http.expectOne('http://localhost:4000/users/printing-houses/count').flush({ count: 0 });
    http.expectOne('http://localhost:4000/products/getTop').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('0');
    expect(fixture.nativeElement.textContent).toContain('Trenutno nema proizvoda za prikaz.');
  });

  it('handles each failed request independently', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:4000/categories/getAll').flush([{ name: 'Pokloni' }]);
    http.expectOne('http://localhost:4000/users/printing-houses/count')
      .flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Broj štamparija trenutno nije dostupan.');
    expect(fixture.nativeElement.textContent).toContain('Učitavanje proizvoda...');
    http.expectOne('http://localhost:4000/products/getTop')
      .flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Proizvodi trenutno nisu dostupni.');
    expect(fixture.nativeElement.textContent).not.toContain('Učitavanje');
  });
});
