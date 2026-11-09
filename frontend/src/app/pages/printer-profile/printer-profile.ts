import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, UserProfile } from '../../services/auth.service';

@Component({
  selector: 'app-printer-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './printer-profile.html',
  styleUrl: './printer-profile.css'
})
export class PrinterProfile implements OnInit {
  private authService = inject(AuthService);
  readonly defaultProfileImage = '/images/profiles/default_profile_image.jpg';
  user: UserProfile | null = null;
  loading = true;
  saving = false;
  imageUploading = false;
  errorMessage = '';
  saveError = '';
  successMessage = '';
  imageUploadMessage = '';
  imageUploadError = '';
  imageUnavailable = false;
  selectedProfileImage: File | null = null;
  readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    institutionName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    registrationNumber: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d{8}$/)] }),
    pib: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[1-9]\d{8}$/)] })
  });

  ngOnInit(): void {
    const username = this.authService.getCurrentUser()?.username;
    if (!username) {
      this.errorMessage = 'Podaci o štampariji nisu dostupni. Prijavite se ponovo.';
      this.loading = false;
      return;
    }
    this.authService.getUser(username).subscribe({
      next: user => {
        this.user = user;
        this.form.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
          institutionName: user.institutionName || '',
          address: user.address || '',
          registrationNumber: user.registrationNumber || '',
          pib: user.pib || ''
        });
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Profil trenutno nije moguće učitati.';
        this.loading = false;
      }
    });
  }

  error(field: keyof typeof this.form.controls): string {
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'Ovo polje je obavezno.';
    if (control.hasError('email')) return 'Unesite ispravnu email adresu.';
    if (field === 'registrationNumber') return 'Matični broj mora imati tačno 8 cifara.';
    if (field === 'pib') return 'PIB mora imati 9 cifara i ne sme počinjati nulom.';
    return 'Unesite ispravnu vrednost.';
  }

  save(): void {
    if (!this.user || this.saving || this.imageUploading) return;
    this.saveError = '';
    this.successMessage = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving = true;
    this.authService.updateUser(this.user.username, this.form.getRawValue()).subscribe({
      next: user => {
        this.user = user;
        this.form.markAsPristine();
        this.successMessage = 'Profil je uspešno ažuriran.';
        this.saving = false;
      },
      error: error => {
        this.saveError = error.error?.message || 'Izmene nije moguće sačuvati.';
        this.saving = false;
      }
    });
  }

  onProfileImageSelected(event: Event): void {
    this.imageUploadMessage = '';
    this.imageUploadError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      input.value = '';
      this.imageUploadError = 'Dozvoljene su samo JPG, PNG i GIF slike.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      input.value = '';
      this.imageUploadError = 'Slika ne sme biti veća od 5 MB.';
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.width < 100 || image.width > 250 || image.height < 100 || image.height > 250) {
        input.value = '';
        this.imageUploadError = 'Dimenzije slike moraju biti između 100x100 i 250x250 px.';
        return;
      }
      this.selectedProfileImage = file;
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      input.value = '';
      this.imageUploadError = 'Sliku nije moguće učitati.';
    };
    image.src = objectUrl;
  }

  uploadProfileImage(input: HTMLInputElement): void {
    if (!this.user || !this.selectedProfileImage || this.imageUploading || this.saving) return;
    this.imageUploading = true;
    this.imageUploadError = '';
    this.authService.uploadProfileImage(this.user.username, this.selectedProfileImage).subscribe({
      next: response => {
        this.user = response.user;
        this.selectedProfileImage = null;
        input.value = '';
        this.imageUploadMessage = response.message;
        this.imageUploading = false;
      },
      error: error => {
        this.imageUploadError = error.error?.message || 'Profilnu sliku nije moguće sačuvati.';
        this.imageUploading = false;
      }
    });
  }

  get profileImageSrc(): string {
    if (this.imageUnavailable) return this.defaultProfileImage;
    const image = this.user?.profileImage?.trim() || this.defaultProfileImage;
    return image.startsWith('/uploads/profiles/') ? 'http://localhost:4000' + image : image;
  }

  onImageError(): void {
    this.imageUnavailable = true;
  }
}
