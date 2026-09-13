import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css'
})
export class LoginForm {
  @Input() admin = false;

  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  submitted = false;
  helpMessage = '';

  submit(): void {
    this.form.markAllAsTouched();
    this.submitted = this.form.valid;
  }

  showHelp(event: Event, type: 'password' | 'registration'): void {
    event.preventDefault();
    this.helpMessage = type === 'password'
      ? 'Obnova lozinke još nije dostupna.'
      : 'Registracija još nije dostupna.';
  }
}
