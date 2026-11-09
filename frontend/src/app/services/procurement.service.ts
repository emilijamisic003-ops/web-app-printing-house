import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PrintService } from './product.service';


export interface ProcurementItem {
  productCode: string;
  productName: string;
  quantity: number;
  selectedColor?: string;
  selectedPrintService?: PrintService | null;
  printText?: string;
}

export interface ProcurementOffer {
  printingHouseUsername: string;
  totalPrice: number;
  createdAt: string;
}

export interface Procurement {
  _id: string;
  procurementId: string;
  clientUsername: string;
  items: ProcurementItem[];
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'finished';
  offers: ProcurementOffer[];
  winningPrintingHouseUsername?: string | null;
  invoiceId?: string;
  invoiceWarning?: string;
  hasOffer?: boolean;
}


@Injectable({ providedIn: 'root' })

export class ProcurementService {

  private http = inject(HttpClient);
  private url = 'http://localhost:4000/procurements';

  getByClient(username: string) {
    return this.http.get<Procurement[]>(this.url + '/client/' + encodeURIComponent(username));
  }

  confirm(clientUsername: string) {
    return this.http.post<{ message: string; procurement: Procurement; warning: string }>(this.url + '/confirm', { clientUsername });
  }

  getActive(printingHouseUsername: string) {
    return this.http.get<Procurement[]>(this.url + '/active/printer/' + encodeURIComponent(printingHouseUsername));
  }
  
  offer(id: string, printingHouseUsername: string, totalPrice: number) {
    return this.http.post<ProcurementOffer>(this.url + '/' + encodeURIComponent(id) + '/offers', { printingHouseUsername, totalPrice });
  }

  report(id: string, clientUsername: string) {
    return this.http.get(this.url + '/' + encodeURIComponent(id) + '/report', {params: { clientUsername }, responseType: 'blob'});
  }


}
