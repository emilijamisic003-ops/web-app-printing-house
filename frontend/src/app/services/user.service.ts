import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface Printer {
  username: string;
  institutionName?: string;
  address?: string;
}

export interface AdminUser {
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  role: string;
  approved: boolean;
  active: boolean;
  clientType?: string;
  institutionName?: string;
  address?: string;
  registrationNumber?: string;
  pib?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {

  private http = inject(HttpClient);

  getPrinterByUsername(username: string) {
    return this.http.get<Printer>('http://localhost:4000/users/printer/' + encodeURIComponent(username));
  }
  
  getPrintingHouseCount() {
    return this.http.get<{ count: number }>('http://localhost:4000/users/printing-houses/count');
  }

  getAdminUsers() {
    return this.http.get<AdminUser[]>('http://localhost:4000/users/admin/all');
  }

  getPendingAdminUsers() {
    return this.http.get<AdminUser[]>('http://localhost:4000/users/admin/pending');
  }

  approveAdminUser(username: string) {
    return this.http.put<AdminUser>('http://localhost:4000/users/admin/' + encodeURIComponent(username) + '/approve', {});
  }

  rejectAdminUser(username: string) {
    return this.http.delete<{ message: string }>('http://localhost:4000/users/admin/' + encodeURIComponent(username) + '/reject');
  }

  updateAdminUser(username: string, data: Partial<AdminUser>) {
    return this.http.put<AdminUser>('http://localhost:4000/users/admin/' + encodeURIComponent(username), data);
  }

  deleteAdminUser(username: string) {
    return this.http.delete<{ message: string }>('http://localhost:4000/users/admin/' + encodeURIComponent(username));
  }
}
