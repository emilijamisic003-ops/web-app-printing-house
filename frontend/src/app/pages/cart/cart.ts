import { Router } from '@angular/router';
import { ProcurementService } from '../../services/procurement.service';
import { Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CartItem, CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

interface CartGroup {
  printingHouseUsername: string;
  items: { item: CartItem; index: number }[];
  subtotal: number;
}

@Component({
  selector: 'app-cart',
  imports: [DecimalPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class Cart implements OnInit {
  private router = inject(Router);
  private procurementService = inject(ProcurementService);
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  printerNames = new Map<string, string>();
  confirming = false;
  successMessage = '';
  warningMessage = '';
  items: CartItem[] = [];
  groups: CartGroup[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.cartService.getCart().subscribe({
      next: cart => this.setItems(cart.items),
      error: () => this.errorMessage = 'Korpu trenutno nije moguće učitati.'
    });
  }

  private setItems(items: CartItem[]): void {
    this.items = items;
    this.groupItems();
    for (const group of this.groups) {
      this.userService.getPrinterByUsername(group.printingHouseUsername).subscribe({
        next: printer => this.printerNames.set(group.printingHouseUsername, printer.institutionName || group.printingHouseUsername),
        error: () => this.printerNames.set(group.printingHouseUsername, group.printingHouseUsername)
      });
    }
  }

  groupItems(): void {
    const groups: CartGroup[] = [];
    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      let group = groups.find(group => group.printingHouseUsername === item.printingHouseUsername);
      if (!group) {
        group = { printingHouseUsername: item.printingHouseUsername, items: [], subtotal: 0 };
        groups.push(group);
      }
      group.items.push({ item, index });
      group.subtotal += item.totalPrice;
    }
    this.groups = groups;
  }

  get totalPrice(): number {
    let total = 0;
    for (const item of this.items) {
      total += item.totalPrice;
    }
    return total;
  }

  removeItem(index: number): void {
    if (this.confirming) return;
    this.errorMessage = '';
    this.cartService.removeItem(index).subscribe({
      next: cart => this.setItems(cart.items),
      error: () => this.errorMessage = 'Izmena korpe nije sačuvana. Pokušajte ponovo.'
    });
  }

  confirm(): void {
    if (this.confirming || !this.items.length) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.warningMessage = '';
    const user = this.authService.getCurrentUser();
    if (user?.role !== 'client' || !user.username) {
      this.errorMessage = 'Potvrda je dostupna prijavljenom klijentu.';
      return;
    }
    this.confirming = true;
    if (user.clientType === 'legal') {
      this.procurementService.confirm(user.username).subscribe({
        next: response => {
          this.items = [];
          this.groupItems();
          this.confirming = false;
          this.successMessage = response.message;
          this.warningMessage = response.warning;
          this.router.navigate(['/client/procurements'], { state: {
            successMessage: response.message, warning: response.warning
          } });
        },
        error: error => {
          this.confirming = false;
          this.errorMessage = error.error?.message || 'Javnu nabavku nije moguće raspisati.';
        }
      });
      return;
    }
    this.orderService.confirmOrder(user.username, this.items).subscribe({
      next: response => {
        this.items = [];
        this.groupItems();
        this.successMessage = 'Narudžbina je uspešno kreirana.';
        this.warningMessage = response.warning || '';
        this.confirming = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Potvrda nije uspela. Proverite porudžbine na profilu pre ponovnog pokušaja.';
        this.confirming = false;
      }
    });
  }
}
