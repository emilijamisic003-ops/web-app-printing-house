import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Order, OrderService } from '../../services/order.service';

@Component({
  selector: 'app-printer-orders',
  imports: [DatePipe],
  templateUrl: './printer-orders.html',
  styleUrl: './printer-orders.css'
})
export class PrinterOrders implements OnInit {
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  orders: Order[] = [];
  loading = true;
  updatingInvoiceId = '';
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    const username = this.authService.getCurrentUser()?.username;
    if (!username) {
      this.errorMessage = 'Podaci o štampariji nisu dostupni.';
      this.loading = false;
      return;
    }
    this.orderService.getOrdersByPrinter(username).subscribe({
      next: orders => {
        this.orders = orders;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Porudžbine nije moguće učitati.';
        this.loading = false;
      }
    });
  }

  nextStatus(order: Order): 'u štampi' | 'isporučeno' | null {
    if (order.status === 'naručeno') return 'u štampi';
    if (order.status === 'u štampi') return 'isporučeno';
    return null;
  }

  changeStatus(order: Order): void {
    const status = this.nextStatus(order);
    if (!status || this.updatingInvoiceId) return;
    this.updatingInvoiceId = order.invoiceId;
    this.errorMessage = '';
    this.successMessage = '';
    this.orderService.updatePrinterOrderStatus(order.invoiceId, status).subscribe({
      next: updatedOrder => {
        for (let index = 0; index < this.orders.length; index++) {
          if (this.orders[index].invoiceId === updatedOrder.invoiceId) this.orders[index] = updatedOrder;
        }
        this.successMessage = 'Status porudžbine je uspešno promenjen.';
        this.updatingInvoiceId = '';
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Status porudžbine nije moguće promeniti.';
        this.updatingInvoiceId = '';
      }
    });
  }
}
