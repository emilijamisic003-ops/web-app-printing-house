import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClientProfile } from '../client-profile/client-profile';
import { PrinterProfile } from '../printer-profile/printer-profile';

@Component({
  selector: 'app-role-home',
  imports: [RouterLink, ClientProfile, PrinterProfile],
  templateUrl: './role-home.html',
  styleUrl: './role-home.css'
})
export class RoleHome {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  username = '';

  constructor() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.username = typeof user?.username === 'string' ? user.username : '';
      } catch {
        this.username = '';
      }
    }
  }

  get title(): string {
    return this.route.snapshot.data['title'];
  }

  get isClient(): boolean {
    return this.route.snapshot.data['role'] === 'client';
  }

  get isAdmin(): boolean {
    return this.route.snapshot.data['role'] === 'admin';
  }

  get isPrinter(): boolean {
    return this.route.snapshot.data['role'] === 'printer';
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.router.navigate([this.isAdmin ? '/admin/login' : '/login']);
  }
}
