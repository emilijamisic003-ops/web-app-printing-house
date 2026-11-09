import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { ArchiveItem, OrderService } from '../../services/order.service';


@Component({
  selector: 'app-archive',
  imports: [DatePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './archive.html',
  styleUrl: './archive.css',
})
export class Archive implements OnInit {

  readonly form = new FormGroup({
    comment: new FormControl(false, { nonNullable: true }),
    status: new FormControl('', { nonNullable: true })
  });

  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  archiveItems: ArchiveItem[] = [];
  loading = true;
  errorMessage = '';
  actionError = '';
  receivingInvoiceId = '';
  reactionMessage = '';
  reactionError = '';
  reactionSendingKey = '';
  commentTexts: Record<string, string> = {};
  commentSendingKey = '';
  sortField: 'date' | 'productName' | 'quantity' | 'printingHouse' = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  private productService = inject(ProductService);
comment: any;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.username || user.role !== 'client') {
      this.loading = false;
      this.errorMessage = 'Podaci o prijavljenom korisniku nisu dostupni.';
      return;
    }
    this.orderService.getClientArchive(user.username).subscribe({
      next: items => {

        this.archiveItems = items.map(item => ({ ...item }));
        this.loading = false;

        if(this.form.get('comment')?.value){
          this.archiveItems = this.archiveItems.filter(item => !item.hasCommented);
        }
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Arhivu proizvoda trenutno nije moguće učitati.';
        this.loading = false;
      }
    });
  }

   forma(){
    this.ngOnInit();
  }

  get sortedItems(): ArchiveItem[] {
    return [...this.archiveItems].sort((first, second) => {
      let comparison: number;
      if (this.sortField === 'date') {
        comparison = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
      } else if (this.sortField === 'quantity') {
        comparison = first.quantity - second.quantity;
      } else if (this.sortField === 'printingHouse') {
        comparison = first.printingHouseUsername.localeCompare(second.printingHouseUsername);
      } else {
        comparison = first.productName.localeCompare(second.productName);
      }
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  sortBy(field: 'date' | 'productName' | 'quantity' | 'printingHouse'): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.sortField = field;
    this.sortDirection = field === 'date' ? 'desc' : 'asc';
  }

  sortAccessibilityLabel(field: string): string {
    if (this.sortField !== field) return 'none';
    if (this.sortDirection === 'asc') return 'ascending';
    return 'descending';
  }

  sortLabel(field: string): string {
    if (this.sortField !== field) return '';
    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  markReceived(invoiceId: string): void {
    if (this.receivingInvoiceId) return;
    this.actionError = '';
    this.receivingInvoiceId = invoiceId;
    this.orderService.markReceived(invoiceId).subscribe({
      next: () => {
        for (const item of this.archiveItems) {
          if (item.invoiceId === invoiceId) item.status = 'primljeno';
        }
        this.receivingInvoiceId = '';
      },
      error: error => {
        this.actionError = error.error?.message || 'Prijem porudžbine nije moguće potvrditi.';
        this.receivingInvoiceId = '';
      }
    });
  }

  reactionKey(item: ArchiveItem): string {
    return JSON.stringify([item.productCode, item.invoiceId]);
  }

  react(item: ArchiveItem, reaction: 'like' | 'dislike'): void {
    if (item.status !== 'primljeno' || item.hasReacted || this.reactionSendingKey) return;
    const key = this.reactionKey(item);
    const username = this.authService.getCurrentUser()?.username;
    if (!username) return;
    this.reactionMessage = '';
    this.reactionError = '';
    this.reactionSendingKey = key;
    this.productService.react(item.productCode, reaction, username, item.invoiceId).subscribe({
      next: () => {
        for (const entry of this.archiveItems) {
          if (this.reactionKey(entry) === key) entry.hasReacted = true;
        }
        this.reactionSendingKey = '';
        this.reactionMessage = reaction === 'like' ? 'Lajk je sačuvan.' : 'Dislajk je sačuvan.';
      },
      error: error => {
        this.reactionSendingKey = '';
        this.reactionError = error.error?.message || 'Reakciju nije moguće sačuvati.';
      }
    });
  }

  commentKey(item: ArchiveItem): string {
    return this.reactionKey(item);
  }

  sendComment(item: ArchiveItem): void {
    if (item.status !== 'primljeno' || item.hasCommented) return;
    const key = this.commentKey(item);
    const username = this.authService.getCurrentUser()?.username;
    const text = this.commentTexts[key]?.trim();
    if (!username || !text || this.commentSendingKey) return;
    this.reactionMessage = '';
    this.reactionError = '';
    this.commentSendingKey = key;
    this.productService.addComment({ productCode: item.productCode, username, invoiceId: item.invoiceId, text }).subscribe({
      next: () => {
        for (const entry of this.archiveItems) {
          if (this.commentKey(entry) === key) entry.hasCommented = true;
        }
        this.commentTexts[key] = '';
        this.reactionMessage = 'Komentar je sačuvan.';
        this.commentSendingKey = '';
      },
      error: error => {
        this.reactionError = error.error?.message || 'Komentar nije moguće sačuvati.';
        this.commentSendingKey = '';
      }
    });
  }

}
