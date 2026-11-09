import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PrintService, Product, ProductComment, ProductService } from '../../services/product.service';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { Printer, UserService } from '../../services/user.service';

@Component({
  selector: 'app-product-details',
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, DatePipe],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css'
})
export class ProductDetails implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private printerRequest?: Subscription;
  private routeSubscription?: Subscription;
  private productRequest?: Subscription;
  private commentsRequest?: Subscription;

  product: Product | null = null;
  printer: Printer | null = null;
  imageFailed = false;
  loading = true;
  errorMessage = '';
  isClient = false;
  cartMessage = '';
  cartError = '';
  configurationForm = new FormGroup({
    quantity: new FormControl<number | null>(1),
    color: new FormControl('', { nonNullable: true }),
    printService: new FormControl<PrintService | null>(null),
    printText: new FormControl('', { nonNullable: true })
  });
  selectedConfiguration: {
    productCode: string;
    quantity: number;
    selectedColor: string;
    selectedPrintService: PrintService | null;
    printText: string;
    totalPrice: number;
  } | null = null;
  comments: ProductComment[] = [];

  get currentUsername(): string {
    return this.authService.getCurrentUser()?.username || '';
  }

  ngOnInit(): void {
    this.isClient = this.authService.getCurrentUser()?.role === 'client';
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const code = params.get('code') ?? '';
      this.loadProduct(code, params.get('printingHouseUsername') ?? '');
    });
  }

  loadProduct(code: string, printingHouseUsername = ''): void {
    this.productRequest?.unsubscribe();
    this.commentsRequest?.unsubscribe();
    this.printerRequest?.unsubscribe();
    this.printer = null;
    this.product = null;
    this.selectedConfiguration = null;
    this.comments = [];
    this.cartMessage = '';
    this.cartError = '';
    this.imageFailed = false;
    this.loading = true;
    this.errorMessage = '';
    this.productRequest = this.productService.getProductByCode(code, printingHouseUsername).subscribe({
      next: (product) => {
        this.product = product;
        this.configurationForm.controls.quantity.setValidators([
          Validators.required, Validators.min(1), Validators.max(product.stock),
          Validators.pattern(/^\d+$/)
        ]);
        this.configurationForm.reset({
          quantity: 1,
          color: product.colors?.[0] ?? '',
          printService: product.printServices?.[0] ?? null,
          printText: ''
        });
        this.loading = false;
        this.commentsRequest = this.productService.getComments(product.code, product.printingHouseUsername || '').subscribe({
          next: comments => this.comments = comments.slice(0, 5),
          error: () => this.comments = []
        });
        if (product.printingHouseUsername) {
          this.printerRequest = this.userService.getPrinterByUsername(product.printingHouseUsername).subscribe({
            next: (printer) => this.printer = printer,
            error: () => this.printer = null
          });
        }
      },
      error: (error) => {
        this.errorMessage = error.status === 404
          ? 'Proizvod nije pronađen'
          : error.error?.message || 'Proizvod trenutno nije dostupan. Pokušajte ponovo kasnije.';
        this.loading = false;
      }
    });
  }

  get mainImageUrl(): string {
    return this.productService.getProductImageUrl(this.product?.mainImage || '');
  }

  get totalPrice(): number {
    const values = this.configurationForm.getRawValue();
    if (!this.product || this.configurationForm.controls.quantity.invalid || values.quantity === null) return 0;
    const additionalPrice = values.printService?.additionalPricePerItem ?? 0;
    return values.quantity * (this.product.unitPrice + additionalPrice);
  }
  
  next(): void {
    this.cartMessage = '';
    this.cartError = '';
    this.selectedConfiguration = null;
    this.configurationForm.markAllAsTouched();
    if (this.authService.getCurrentUser()?.role !== 'client' || !this.product || this.configurationForm.invalid) return;
    const { quantity, color, printService, printText } = this.configurationForm.getRawValue();
    this.selectedConfiguration = {
      productCode: this.product.code,
      quantity: quantity!,
      selectedColor: color,
      selectedPrintService: printService,
      printText,
      totalPrice: this.totalPrice
    };
    this.cartService.addItem({
        ...this.selectedConfiguration,
        productName: this.product.name,
        printingHouseUsername: this.product.printingHouseUsername,
        unitPrice: this.product.unitPrice
    }).subscribe({
      next: () => this.cartMessage = 'Proizvod je dodat u korpu.',
      error: () => this.cartError = 'Korpa nije sačuvana. Pokušajte ponovo.'
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.productRequest?.unsubscribe();
    this.commentsRequest?.unsubscribe();
    this.printerRequest?.unsubscribe();
  }
}
