import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { matchingPasswords, passwordValidators } from '../../shared/validators/password';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  submitting = false;
  completed = false;
  errorMessage = '';

  get token(): string {
    return this.route.snapshot.queryParamMap.get('token')?.trim() || '';
  }

  
  readonly form = new FormGroup({
    newPassword: new FormControl('', { nonNullable: true, validators: passwordValidators }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: matchingPasswords });
  statusMessage = '';

  error(field: 'newPassword' | 'confirmPassword'): string {
    const control = this.form.controls[field];
    if (!control.touched) return '';
    if (control.hasError('required')) {
      return field === 'newPassword' ? 'Unesite novu lozinku.' : 'Ponovite novu lozinku.';
    }
    if (field === 'newPassword' && control.invalid) {
      return 'Lozinka mora imati 8–12 karaktera, počinjati slovom i sadržati veliko slovo, broj i specijalni karakter.';
    }
    if (field === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      return 'Lozinke se ne podudaraju.';
    }
    return '';
  }

  submit(): void {
    if (this.submitting || this.completed) return;
    this.statusMessage = '';
    this.errorMessage = '';
    this.form.markAllAsTouched();
    if (!this.token) {
      this.errorMessage = 'Link nije ispravan.';
      return;
    }
    if (this.form.invalid) return;
    this.submitting = true;
    this.authService.resetPassword(this.token, this.form.controls.newPassword.value).subscribe({
      next: response => {
        this.statusMessage = response.message;
        this.completed = true;
        this.submitting = false;
        this.form.reset();
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Greška pri promeni lozinke.';
        this.submitting = false;
      }
    });
  }
}
