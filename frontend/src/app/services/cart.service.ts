import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PrintService } from './product.service';

export interface CartItem {
  productCode: string;
  productName: string;
  printingHouseUsername: string;
  quantity: number;
  selectedColor: string;
  selectedPrintService: PrintService | null;
  printText: string;
  unitPrice: number;
  totalPrice: number;
}

export interface CartResponse {
  clientUsername: string;
  items: CartItem[];
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);

  private getUsername(): string | null {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') ?? 'null');
      if (currentUser && typeof currentUser.username === 'string' && currentUser.username.trim()) 
        return currentUser.username;

      return null;
    } catch {
      return null;
    }
  }

  getCart(username = this.getUsername()): Observable<CartResponse> {
    return this.http.get<CartResponse>('http://localhost:4000/carts/' + encodeURIComponent(username || ''));
  }

  addItem(item: CartItem, username = this.getUsername()) {
    return this.http.post<CartResponse>('http://localhost:4000/carts/' + encodeURIComponent(username || '') + '/items', item);
  }

  removeItem(index: number, username = this.getUsername()) {
    return this.http.delete<CartResponse>('http://localhost:4000/carts/' + encodeURIComponent(username || '') + '/items/' + index);
  }

  clearCart(username = this.getUsername()) {
    return this.http.delete<CartResponse>('http://localhost:4000/carts/' + encodeURIComponent(username || ''));
  }
}
