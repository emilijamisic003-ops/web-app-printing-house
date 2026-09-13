import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

type AccountType = 'individual' | 'legal' | 'printing';

function profileImageValidator(control: AbstractControl) {
  const file = control.value as File | null;
  if (!file) return null;
  return /\.(jpe?g|png|gif)$/i.test(file.name)
    && ['image/jpeg', 'image/png', 'image/gif'].includes(file.type)
    ? null : { imageType: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  readonly form = new FormGroup({
    accountType: new FormControl<AccountType>('individual', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [
      Validators.required, Validators.minLength(8), Validators.maxLength(12),
      Validators.pattern(/^(?=.*\p{Lu})(?=.*[0-9])(?=.*[\p{P}\p{S}])\p{L}.*$/u)
    ] }),
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    profileImage: new FormControl<File | null>(null, { validators: [profileImageValidator] }),
    institution: new FormGroup({
      name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      registrationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9]{8}$/)] }),
      pib: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[1-9][0-9]{8}$/)] })
    })
  });

  statusMessage = '';

  constructor() {
    this.form.controls.institution.disable();
    this.form.controls.accountType.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => {
      if (type === 'individual') {
        this.form.controls.institution.disable();
      } else {
        this.form.controls.institution.enable();
      }
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.statusMessage = '');
  }

  get isInstitution(): boolean {
    return this.form.controls.accountType.value !== 'individual';
  }

  error(path: string): string {
    const control = this.form.get(path);
    if (!control?.enabled || !control.touched || !control.errors) return '';
    if (control.hasError('required')) return 'Ovo polje je obavezno.';
    if (control.hasError('email')) return 'Unesite ispravnu email adresu.';
    if (control.hasError('imageType')) return 'Izaberite sliku u JPG, PNG ili GIF formatu.';
    if (path === 'password') {
      return 'Lozinka mora imati 8–12 karaktera, počinjati slovom i sadržati veliko slovo, broj i specijalni karakter.';
    }
    if (path === 'institution.registrationNumber') return 'Matični broj mora imati tačno 8 cifara.';
    if (path === 'institution.pib') return 'PIB mora imati tačno 9 cifara i ne sme počinjati nulom.';
    return '';
  }

  selectImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls.profileImage.setValue(input.files?.[0] ?? null);
    this.form.controls.profileImage.markAsTouched();
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.statusMessage = this.form.valid
      ? 'Podaci su ispravno uneti. Registracija još nije omogućena; nalog nije kreiran.'
      : 'Proverite označena polja.';
  }
}
