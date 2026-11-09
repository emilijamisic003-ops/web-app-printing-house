import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, UserProfile } from '../../services/auth.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Order, OrderService } from '../../services/order.service';
import { Printer, UserService } from '../../services/user.service';

type OrderSort = 'invoiceId' | 'printingHouse' | 'totalPrice' | 'status' | 'createdAt';

@Component({
  selector: 'app-client-profile',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './client-profile.html',
  styleUrl: './client-profile.css'
})
export class ClientProfile implements OnInit {

  states = ['naručeno', 'u štampi', 'isporučeno', 'primljeno'];
  statusFilter: any = '';
  filteredOrders: Order[] = [];
  filterOrders() {
    if(this.statusFilter || this.statusFilter.trim() || this.statusFilter !== 'Svi statusi'){
      this.filteredOrders = this.orders.filter(order => order.status === this.statusFilter);
    }
    else {
      this.filteredOrders = this.orders;
    }
  }

  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  readonly defaultProfileImage = '/images/profiles/default_profile_image.jpg';
  defaultImageFailed = false;
  orders: Order[] = [];
  printers = new Map<string, Printer>();
  ordersLoading = false;
  ordersError = '';
  cancelError = '';
  cancelling = new Set<string>();
  sortField: OrderSort = 'createdAt';
  sortAscending = false;
  user: UserProfile | null = null;
  loading = false;
  errorMessage = '';
  imageUnavailable = false;
  saving = false;
  successMessage = '';
  saveError = '';
  selectedProfileImage: File | null = null;
  imageUploading = false;
  imageUploadMessage = '';
  imageUploadError = '';
  readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    institutionName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    registrationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9]{8}$/)] }),
    pib: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[1-9][0-9]{8}$/)] })
  });


  fillForm(user: UserProfile): void {
    this.user = user;
    this.imageUnavailable = false;
    this.defaultImageFailed = false;
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
    for (const field of ['institutionName', 'address', 'registrationNumber', 'pib'] as const) {
      if (user.clientType === 'legal') {
        this.form.controls[field].enable();
      } else {
        this.form.controls[field].disable();
      }
    }
  }

  error(field: keyof typeof this.form.controls): string {
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'Ovo polje je obavezno.';
    if (control.hasError('email')) return 'Unesite ispravnu email adresu.';
    if (field === 'pib') return 'PIB mora imati 9 cifara i ne sme počinjati nulom.';
    return 'Matični broj mora imati tačno 8 cifara.';
  }

  save(): void {
    if (!this.user || this.saving || this.imageUploading) return;
    this.successMessage = '';
    this.saveError = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving = true;
    this.authService.updateUser(this.user.username, this.form.value).subscribe({
      next: (user) => {
        this.fillForm(user);
        this.form.markAsPristine();
        this.successMessage = 'Profil je uspešno ažuriran.';
        this.saving = false;
      },
      error: (error) => {
        this.saveError = error.error?.message || 'Izmene nije moguće sačuvati. Pokušajte ponovo.';
        this.saving = false;
      }
    });
  }


  onProfileImageSelected(event: Event): void {
    this.imageUploadMessage = '';
    this.imageUploadError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedProfileImage = null;
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.selectedProfileImage = null;
      input.value = '';
      this.imageUploadError = 'Dozvoljene su samo JPG, PNG i GIF slike.';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.selectedProfileImage = null;
      input.value = '';
      this.imageUploadError = 'Slika ne sme biti veća od 5 MB.';
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.width < 100 || image.width > 250 || image.height < 100 || image.height > 250) {
        this.selectedProfileImage = null;
        input.value = '';
        this.imageUploadError = 'Dimenzije slike moraju biti između 100x100 i 250x250 px.';
        return;
      }
      this.selectedProfileImage = file;
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      this.selectedProfileImage = null;
      input.value = '';
      this.imageUploadError = 'Sliku nije moguće učitati.';
    };
    image.src = objectUrl;
  }

  uploadProfileImage(input?: HTMLInputElement): void {
    if (!this.user || !this.selectedProfileImage || this.imageUploading || this.saving) return;

    this.imageUploading = true;
    this.imageUploadMessage = '';
    this.imageUploadError = '';

    this.authService.uploadProfileImage(this.user.username, this.selectedProfileImage).subscribe({
      next: (response) => {
        this.user = response.user;
        this.imageUnavailable = false;
        this.defaultImageFailed = false;
        if (input) input.value = '';
        this.selectedProfileImage = null;
        this.imageUploadMessage = response.message;
        this.imageUploading = false;
      },
      error: (error) => {
        this.imageUploadError = error.error?.message || 'Profilnu sliku nije moguće sačuvati.';
        this.imageUploading = false;
      }
    });
  }

  ngOnInit(): void {
    let username: string;
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (typeof currentUser?.username !== 'string' || !currentUser.username.trim()) {
        this.errorMessage = 'Podaci o prijavljenom korisniku nisu dostupni. Prijavite se ponovo.';
        return;
      }
      username = currentUser.username;
    } catch {
      this.errorMessage = 'Podaci o prijavljenom korisniku nisu ispravni. Prijavite se ponovo.';
      return;
    }

    this.loading = true;
    this.authService.getUser(username).subscribe({
      next: (user) => {
        this.fillForm(user);
        this.loading = false;
        this.loadOrders(username);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Profil trenutno nije moguće učitati. Pokušajte ponovo kasnije.';
        this.loading = false;
      }
    });
  }

  get clientTypeLabel(): string {
    if (this.user?.clientType === 'legal') return 'Pravno lice';
    if (this.user?.clientType === 'individual') return 'Fizičko lice';
    return this.user?.clientType || 'Nije naveden.';
  }

  get profileImageSrc(): string {
    if (this.imageUnavailable) return this.defaultProfileImage;
    const image = this.user?.profileImage?.trim() || this.defaultProfileImage;
    return image.startsWith('/uploads/profiles/') ? 'http://localhost:4000' + image : image;
  }

  onImageError(): void {
    if (this.profileImageSrc === this.defaultProfileImage) this.defaultImageFailed = true;
    else this.imageUnavailable = true;
  }

  loadOrders(username: string): void {
    this.ordersLoading = true;
    this.ordersError = '';
    this.orderService.getOrdersByClient(username).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = orders;
        this.ordersLoading = false;
        this.sortOrders();
        const printerUsernames: string[] = [];
        for (const order of orders) {
          if (!printerUsernames.includes(order.printingHouseUsername)) printerUsernames.push(order.printingHouseUsername);
        }
        for (const printerUsername of printerUsernames) {
          this.userService.getPrinterByUsername(printerUsername).subscribe({
            next: (printer) => {
              this.printers.set(printerUsername, printer);
              this.sortOrders();
            },
            error: () => { /* Koristimo korisničko ime ako podaci štamparije nisu dostupni. */ }
          });
        }
      },
      error: () => {
        this.ordersLoading = false;
        this.ordersError = 'Porudžbine trenutno nije moguće učitati.';
      }
    });
  }

  printerName(username: string): string {
    return this.printers.get(username)?.institutionName?.trim() || username;
  }

  toggleSort(field: OrderSort): void {
    this.sortAscending = this.sortField === field ? !this.sortAscending : true;
    this.sortField = field;
    this.sortOrders();
  }

  sortAccessibilityLabel(field: OrderSort): string {
    if (this.sortField !== field) return 'none';
    if (this.sortAscending) return 'ascending';
    return 'descending';
  }

  sortMark(field: OrderSort): string {
    if (this.sortField !== field) return '';
    if (this.sortAscending) return ' ↑';
    return ' ↓';
  }

  sortOrders(): void {
    const value = (order: Order): string | number => {
      if (this.sortField === 'printingHouse') return this.printerName(order.printingHouseUsername);
      if (this.sortField === 'createdAt') return Date.parse(order.createdAt) || 0;
      return order[this.sortField] ?? '';
    };
    this.orders.sort((a, b) => {
      const left = value(a), right = value(b);
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right : String(left).localeCompare(String(right), 'sr', { numeric: true });
      return this.sortAscending ? result : -result;
    });
  }

  cancelOrder(order: Order): void {
    window.alert("usli")
    if (!['naručeno', 'u štampi'].includes(order.status) || !order.invoiceId || this.cancelling.has(order.invoiceId)) return;
    window.alert("proslo")
    this.cancelError = '';
    this.cancelling.add(order.invoiceId);
    this.orderService.cancelOrder(order.invoiceId).subscribe({
      next: (updated) => {
        for (let index = 0; index < this.orders.length; index++) {
          if (this.orders[index]._id === updated._id) this.orders[index] = updated;
        }
        this.sortOrders();
        this.cancelling.delete(order.invoiceId);
      },
      error: (error) => {
        this.cancelError = error.error?.message || 'Porudžbinu nije moguće otkazati.';
        this.cancelling.delete(order.invoiceId);
      }
    });
  }
}
