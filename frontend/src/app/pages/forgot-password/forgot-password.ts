import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  
  private authService = inject(AuthService);
  submitting = false;
  errorMessage = '';
  
  readonly form = new FormGroup({
    identifier: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });
  statusMessage = '';


  submit(): void {
    if (this.submitting) return;
    this.statusMessage = '';
    this.errorMessage = '';
    const identifier = this.form.controls.identifier.value.trim();
    this.form.controls.identifier.setValue(identifier);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.submitting = true;
    this.authService.forgotPassword(identifier).subscribe({
      next: response => {
        this.statusMessage = response.message;
        this.submitting = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Greška pri slanju email poruke.';
        this.submitting = false;
      }
    });
  }
}
