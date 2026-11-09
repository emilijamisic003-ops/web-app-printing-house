import { Component, inject, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';

type LoginResponse = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  clientType?: string | null;
};

@Component({    
  selector: 'app-login-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css'
})   
export class LoginForm {

  private authService = inject(AuthService);
  private router = inject(Router);

  @Input() admin = false;

  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  user: object | null = null;
  successMessage = '';
  errorMessage = '';
  isSubmitting = false;

  submit(): void {
    
    if (this.isSubmitting) return;

    this.user = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { username, password } = this.form.getRawValue();
    this.isSubmitting = true;

    const loginRequest = (this.admin
      ? this.authService.adminLogin(username, password)
      : this.authService.login(username, password)) as Observable<LoginResponse>;
    loginRequest.subscribe({
      next: (user) => {
        this.user = user;
        this.successMessage = 'Uspešno ste se prijavili.';
        this.isSubmitting = false;
        localStorage.setItem('currentUser', JSON.stringify(user));

        if (this.admin) {
          this.router.navigate(['/admin']);
        } else if (user.role === 'client') {
          this.router.navigate(['/client']);
        } else if (user.role === 'printer') {
          this.router.navigate(['/printer']);
        } else if (user.role === 'admin') {
          this.router.navigate(['/admin']);
        }
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Prijava trenutno nije moguća. Pokušajte ponovo.';
        this.isSubmitting = false;
      }
    });
  }

}
