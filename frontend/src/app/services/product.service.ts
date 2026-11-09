import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface PrintService {
  serviceId: string;
  name?: string;
  maxDimensions?: string;
  printType: string;
  additionalPricePerItem?: number;
  maxWidthMm?: number;
  maxHeightMm?: number;
}

export interface Product {
  _id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  subcategory: string;
  stock: number;
  unitPrice: number;
  likes: number;
  dislikes: number;
  printingHouseUsername: string;
  mainImage: string;
  additionalImages: string[];
  colors: string[];
  printServices: PrintService[];
  active: boolean;
}

export interface ProductComment {
  _id: string;
  productCode: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface PrinterProductData {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  unitPrice: number;
  stock: number;
  colors: string[];
  mainImage: string;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {

  private http = inject(HttpClient);

  getProductByCode(code: string, printingHouseUsername = '') {
    let params = new HttpParams();
    if (printingHouseUsername) params = params.set('printingHouseUsername', printingHouseUsername);
    return this.http.get<Product>('http://localhost:4000/products/' + encodeURIComponent(code), { params });
  }

  getProductImageUrl(imagePath: string): string {
    if (imagePath.startsWith('/images/products/')) return 'http://localhost:4000' + imagePath;
    return imagePath;
  }

  searchProducts(name = '', category = '', sort = '') {
    let params = new HttpParams();
    if (name.trim()) params = params.set('name', name.trim());
    if (category && category !== 'all') params = params.set('category', category);
    if (sort) params = params.set('sort', sort);
    return this.http.get<Product[]>('http://localhost:4000/products/search', { params });
  }

  getAllProducts() {
    return this.http.get<Product[]>('http://localhost:4000/products/getAll');
  }

  getTopProducts() {
    return this.http.get<Product[]>('http://localhost:4000/products/getTop');
  }

  react(code: string, reaction: 'like' | 'dislike', username: string, invoiceId: string) {
    return this.http.post<{ likes: number; dislikes: number }>('http://localhost:4000/products/' + encodeURIComponent(code) + '/reaction', { username, productCode: code, invoiceId, reaction });
  }

  getComments(code: string, printingHouseUsername: string) {
    return this.http.get<ProductComment[]>('http://localhost:4000/comments/product/' + encodeURIComponent(code), { params: { printingHouseUsername } });
  }

  addComment(comment: { productCode: string; username: string; invoiceId: string; text: string }) {
    return this.http.post<ProductComment>('http://localhost:4000/comments', comment);
  }

  getProductsByPrinter(username: string) {
    return this.http.get<Product[]>('http://localhost:4000/products/printer/' + encodeURIComponent(username));
  }

  createPrinterProduct(product: PrinterProductData & { code: string }, printingHouseUsername: string) {
    return this.http.post<Product>('http://localhost:4000/products/printer/create', {...product, printingHouseUsername});
  }

  updatePrinterProductStock(code: string, stock: number, printingHouseUsername: string) {
    return this.http.put<Product>('http://localhost:4000/products/printer/' + encodeURIComponent(code) + '/stock', { printingHouseUsername, stock });
  }

  uploadPrinterProductImage(code: string, file: File, printingHouseUsername: string) {
    const formData = new FormData();
    formData.append('productImage', file);
    formData.append('printingHouseUsername', printingHouseUsername);
    return this.http.put<Product>('http://localhost:4000/products/printer/' + encodeURIComponent(code) + '/image', formData);
  }

  addPrintService(code: string, service: { serviceId: string; name: string; maxHeightMm: number; maxWidthMm: number; additionalPricePerItem: number }, printingHouseUsername: string) {
    return this.http.post<Product>('http://localhost:4000/products/printer/' + encodeURIComponent(code) + '/print-services', service, {headers: { 'X-Printer-Username': printingHouseUsername }});
  }

  removePrintService(code: string, serviceId: string, printingHouseUsername: string) {
    return this.http.delete<Product>('http://localhost:4000/products/printer/' + encodeURIComponent(code) + '/print-services/' + encodeURIComponent(serviceId), {body: { printingHouseUsername }});
  }

  importPrinterProducts(printingHouseUsername: string, products: unknown[]) {
    return this.http.post<{ count: number; products: Product[] }>('http://localhost:4000/products/printer/import', {printingHouseUsername, products});
  }

}
