import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { matchingPasswords, passwordValidators } from '../../shared/validators/password';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword {
  readonly form = new FormGroup({
    newPassword: new FormControl('', { nonNullable: true, validators: passwordValidators }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: matchingPasswords });
  statusMessage = '';

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.statusMessage = '');
  }

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
    this.form.markAllAsTouched();
    this.statusMessage = this.form.valid
      ? 'Promena lozinke još nije omogućena. Lozinka nije promenjena.' : '';
  }
}
