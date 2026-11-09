import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUser, UserService } from '../../services/user.service';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css'
})
export class AdminUsers implements OnInit {

  private userService = inject(UserService);

  users: AdminUser[] = [];
  editingUsername = '';
  editForm: Partial<AdminUser> = {};

  loading = true;
  saving = false;

  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.userService.getAdminUsers().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Korisnike trenutno nije moguće učitati.';
        this.loading = false;
      }
    });
  }

  startEditing(user: AdminUser): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.editingUsername = user.username;
    this.editForm = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email
    };
  }

  cancelEditing(): void {
    this.editingUsername = '';
    this.editForm = {};
  }

  saveUser(user: AdminUser): void {
    if (!this.editingUsername || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    const updatedFields = {
      firstName: this.editForm.firstName,
      lastName: this.editForm.lastName,
      phone: this.editForm.phone,
      email: this.editForm.email
    }
    if(user.email == this.editForm.email){
        updatedFields.email = ''
    }
    this.userService.updateAdminUser(this.editingUsername, updatedFields).subscribe({
      next: () => {
        this.saving = false;
        this.editingUsername = '';
        this.editForm = {};
        this.successMessage = 'Korisnik je uspešno izmenjen.';
        this.loadUsers();
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error.error?.message || 'Korisnika nije moguće izmeniti.';
      }
    });
  }

  deleteUser(user: AdminUser): void {
    if (user.role === 'admin' || !window.confirm('Da li želite da obrišete korisnika?')) return;
    this.errorMessage = '';
    this.userService.deleteAdminUser(user.username).subscribe({
      next: () => {
        this.successMessage = 'Korisnik je obrisan.';
        this.loadUsers();
      },
      error: error => this.errorMessage = error.error?.message || 'Korisnika nije moguće obrisati.'
    });
  }
}
