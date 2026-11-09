import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Procurement, ProcurementService } from '../../services/procurement.service';

@Component({
  selector: 'app-printer-procurements',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './printer-procurements.html',
  styleUrl: './printer-procurements.css'
})
export class PrinterProcurements implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private procurementService = inject(ProcurementService);
  private timer?: ReturnType<typeof setInterval>;
  now = Date.now();
  procurements: Procurement[] = [];
  loading = false;
  error = '';
  offerError = '';
  message = '';
  saving = false;
  selected: Procurement | null = null;
  form = new FormGroup({
    totalPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)])
  });
  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => this.now = Date.now(), 1000);
  }
  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  refresh(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.username || user.role !== 'printer' || this.loading || this.saving) return;
    this.loading = true; this.error = '';
    this.procurementService.getActive(user.username).subscribe({
      next: procurements => {
        this.procurements = procurements;
        this.loading = false;
      },
      error: error => { this.error = error.error?.message || 'Nabavke nije moguće učitati.'; this.loading = false; }
    });
  }
  remaining(procurement: Procurement): string {
    const seconds = Math.max(0, Math.ceil((Date.parse(procurement.expiresAt) - this.now) / 1000));
    if (!seconds) return 'Istekla';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = String(seconds % 60).padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  }
  expired(procurement: Procurement): boolean { return Date.parse(procurement.expiresAt) <= this.now; }
  open(procurement: Procurement): void {
    if (this.saving || procurement.hasOffer || this.expired(procurement)) return;
    this.selected = procurement; this.offerError = ''; this.message = '';
    this.form.reset();
  }
  cancel(): void {
    if (this.saving) return;
    this.selected = null;
    this.form.reset();
    this.offerError = '';
  }
  submit(): void {
    const user = this.authService.getCurrentUser();
    if (this.saving || !this.selected || !user?.username || user.role !== 'printer') return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (this.expired(this.selected)) { this.offerError = 'Rok za ponude je istekao.'; return; }
    this.saving = true; this.offerError = '';
    const selected = this.selected;
    this.procurementService.offer(selected.procurementId, user.username, this.form.controls.totalPrice.value!).subscribe({
      next: () => {
        selected.hasOffer = true;
        this.saving = false;
        this.cancel();
        this.message = 'Ponuda je poslata.';
      },
      error: error => { this.saving = false; this.offerError = error.error?.message || 'Ponudu nije moguće poslati.'; }
    });
  }
}
