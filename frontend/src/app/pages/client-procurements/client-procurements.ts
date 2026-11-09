import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Procurement, ProcurementService } from '../../services/procurement.service';

@Component({
  selector: 'app-client-procurements',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './client-procurements.html',
  styleUrl: './client-procurements.css'
})
export class ClientProcurements implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private procurementService = inject(ProcurementService);
  private timer?: ReturnType<typeof setInterval>;
  private username = '';
  now = Date.now();
  procurements: Procurement[] = [];
  loading = false;
  listError = '';
  successMessage = '';
  warning = '';
  reportError = '';
  downloading = '';
  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.username || user.role !== 'client' || user.clientType !== 'legal') return;
    this.username = user.username;
    this.successMessage = history.state?.successMessage || '';
    this.warning = history.state?.warning || '';
    this.refresh();
    this.timer = setInterval(() => this.now = Date.now(), 1000);
  }
  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  refresh(): void {
    if (!this.username || this.loading) return;
    this.loading = true;
    this.listError = '';
    this.procurementService.getByClient(this.username).subscribe({
      next: procurements => {
        this.procurements = procurements;
        this.loading = false;
      },
      error: error => {
        this.listError = error.error?.message || 'Javne nabavke nije moguće učitati.';
        this.loading = false;
      }
    });
  }
  winningPrice(procurement: Procurement): number | undefined {
    return procurement.offers.find(offer => offer.printingHouseUsername === procurement.winningPrintingHouseUsername)?.totalPrice;
  }
  downloadReport(procurement: Procurement): void {
    if (this.downloading) return;
    this.reportError = '';
    this.downloading = procurement.procurementId;
    this.procurementService.report(procurement.procurementId, this.username).subscribe({
      next: pdf => {
        const url = URL.createObjectURL(pdf);
        const link = document.createElement('a');
        link.href = url;
        link.download = procurement.procurementId + '.pdf';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloading = '';
      },
      error: () => { this.reportError = 'PDF izveštaj nije moguće preuzeti.'; this.downloading = ''; }
    });
  }
  statusLabel(procurement: Procurement): string {
    if (procurement.status === 'finished') return 'Završena';
    const seconds = Math.max(0, Math.ceil((new Date(procurement.expiresAt).getTime() - this.now) / 1000));
    if (!seconds) return 'Istekla — osvežite listu za izbor ponude';
    return `Aktivna — preostalo ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
