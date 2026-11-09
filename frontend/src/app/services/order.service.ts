import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CartItem } from './cart.service';

export interface Order {
  _id: string;
  invoiceId: string;
  clientUsername: string;
  printingHouseUsername: string;
  items: { productCode: string; productName: string; quantity: number }[];
  totalPrice: number;
  status: string;
  createdAt: string;
}

export interface ArchiveItem {
  invoiceId: string;
  createdAt: string;
  productCode: string;
  productName: string;
  quantity: number;
  printingHouseUsername: string;
  status: 'isporučeno' | 'primljeno';
  hasReacted: boolean;
  hasCommented: boolean;
}

@Injectable({ providedIn: 'root' })
export class OrderService {

  private http = inject(HttpClient);

  confirmOrder(clientUsername: string, items: CartItem[]) {
    return this.http.post<{ message: string; orders: Order[]; warning?: string }>('http://localhost:4000/orders/confirm', { clientUsername, items });
  }

  getOrdersByClient(username: string) {
    return this.http.get<Order[]>('http://localhost:4000/orders/client/' + encodeURIComponent(username));
  }

  getOrdersByPrinter(username: string) {
    return this.http.get<Order[]>('http://localhost:4000/orders/printer/' + encodeURIComponent(username));
  }

  updatePrinterOrderStatus(invoiceId: string, status: 'u štampi' | 'isporučeno') {
    return this.http.put<Order>('http://localhost:4000/orders/' + encodeURIComponent(invoiceId) + '/status', { status });
  }

  getClientArchive(username: string) {
    return this.http.get<ArchiveItem[]>('http://localhost:4000/orders/client/' + encodeURIComponent(username) + '/archive');
  }

  markReceived(invoiceId: string) {
    return this.http.put<Order>('http://localhost:4000/orders/' + encodeURIComponent(invoiceId) + '/received', {});
  }

  cancelOrder(invoiceId: string) {
    return this.http.put<Order>('http://localhost:4000/orders/' + encodeURIComponent(invoiceId) + '/cancel', {});
  }
}
