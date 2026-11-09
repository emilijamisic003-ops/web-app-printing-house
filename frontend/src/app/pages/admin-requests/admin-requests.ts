import { Component, OnInit, inject } from '@angular/core';
import { AdminUser, UserService } from '../../services/user.service';

@Component({
  selector: 'app-admin-requests',
  imports: [],
  templateUrl: './admin-requests.html',
  styleUrl: './admin-requests.css'
})
export class AdminRequests implements OnInit {
  private userService = inject(UserService);
  users: AdminUser[] = [];
  loading = true;
  processingUsername = '';
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';
    this.userService.getPendingAdminUsers().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Zahteve trenutno nije moguće učitati.';
        this.loading = false;
      }
    });
  }

  approve(user: AdminUser): void {
    if (this.processingUsername) return;
    this.processingUsername = user.username;
    this.errorMessage = '';
    this.userService.approveAdminUser(user.username).subscribe({
      next: () => {
        this.users = this.users.filter(item => item.username !== user.username);
        this.successMessage = 'Korisnik je odobren.';
        this.processingUsername = '';
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Korisnika nije moguće odobriti.';
        this.processingUsername = '';
      }
    });
  }

  reject(user: AdminUser): void {
    if (this.processingUsername || !window.confirm('Da li želite da odbijete ovaj zahtev?')) return;
    this.processingUsername = user.username;
    this.errorMessage = '';
    this.userService.rejectAdminUser(user.username).subscribe({
      next: () => {
        this.users = this.users.filter(item => item.username !== user.username);
        this.successMessage = 'Zahtev je odbijen.';
        this.processingUsername = '';
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Zahtev nije moguće odbiti.';
        this.processingUsername = '';
      }
    });
  }
}
