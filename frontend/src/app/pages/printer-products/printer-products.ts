import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Category, CategoryService } from '../../services/category.service';
import { PrinterProductData, Product, ProductService } from '../../services/product.service';

interface ProductForm extends PrinterProductData { code: string; colorsText: string; }
interface PrintServiceForm {
  productCode: string;
  serviceId: string;
  name: string;
  maxHeightMm: number | null;
  maxWidthMm: number | null;
  additionalPricePerItem: number;
}

@Component({
  selector: 'app-printer-products',
  imports: [FormsModule],
  templateUrl: './printer-products.html',
  styleUrl: './printer-products.css'
})
export class PrinterProducts implements OnInit {
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  products: Product[] = [];
  categories: Category[] = [];
  stockValues: Record<string, number> = {};
  loading = true;
  saving = false;
  creating = false;
  serviceFormOpen = false;
  errorMessage = '';
  successMessage = '';
  form: ProductForm = this.emptyForm();
  selectedProductImage: File | null = null;
  serviceForm: PrintServiceForm = this.emptyServiceForm();

  ngOnInit(): void {
    this.loadProducts();
    this.categoryService.getAllCategories().subscribe({
      next: categories => this.categories = categories,
      error: () => this.errorMessage = 'Kategorije trenutno nije moguće učitati.'
    });
  }

  loadProducts(): void {
    const username = this.authService.getCurrentUser()?.username;
    if (!username) { this.errorMessage = 'Podaci o štampariji nisu dostupni.'; this.loading = false; return; }
    this.productService.getProductsByPrinter(username).subscribe({
      next: products => {
        this.products = products;
        for (const product of products) this.stockValues[product.code] = product.stock;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Proizvode nije moguće učitati.';
        this.loading = false;
      }
    });
  }

  startCreating(): void {
    this.creating = true;
    this.form = this.emptyForm();
    this.selectedProductImage = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelCreating(): void {
    this.creating = false;
    this.form = this.emptyForm();
    this.selectedProductImage = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  startAddingService(): void {
    this.serviceFormOpen = true;
    this.serviceForm = this.emptyServiceForm();
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelAddingService(): void {
    this.serviceFormOpen = false;
    this.serviceForm = this.emptyServiceForm();
  }

  categoryChanged(): void {
    const category = this.categories.find(item => item.name === this.form.category);
    if (!category?.subcategories.includes(this.form.subcategory)) this.form.subcategory = '';
  }

  get selectedSubcategories(): string[] {
    return this.categories.find(category => category.name === this.form.category)?.subcategories || [];
  }

  onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedProductImage = null;
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      input.value = '';
      this.errorMessage = 'Dozvoljene su samo JPG, PNG i GIF slike.';
      return;
    }
    this.errorMessage = '';
    this.selectedProductImage = file;
  }

  save(): void {
    const username = this.authService.getCurrentUser()?.username;
    if (!username || this.saving || !this.validForm()) return;
    const colors: string[] = [];
    for (const value of this.form.colorsText.split(',')) {
      const color = value.trim();
      if (color) colors.push(color);
    }
    const product: PrinterProductData = {
      name: this.form.name.trim(), description: this.form.description.trim(),
      category: this.form.category, subcategory: this.form.subcategory,
      unitPrice: this.form.unitPrice, stock: this.form.stock,
      colors,
      mainImage: '', active: this.form.active
    };
    this.saving = true;
    this.errorMessage = '';
    this.productService.createPrinterProduct({ ...product, code: this.form.code.trim() }, username).subscribe({
      next: productResponse => {
        this.products.push(productResponse);
        this.stockValues[productResponse.code] = productResponse.stock;
        if (this.selectedProductImage) {
          this.productService.uploadPrinterProductImage(productResponse.code, this.selectedProductImage, username).subscribe({
            next: updatedProduct => {
              this.replaceProduct(updatedProduct);
              this.finishCreate();
            },
            error: error => {
              this.finishCreate();
              this.errorMessage = 'Proizvod je sačuvan, ali sliku nije moguće sačuvati.';
              if (error.error?.message) this.errorMessage += ' ' + error.error.message;
            }
          });
        } else this.finishCreate();
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Proizvod nije moguće sačuvati.';
        this.saving = false;
      }
    });
  }

  saveStock(product: Product): void {
    const username = this.authService.getCurrentUser()?.username;
    const stock = this.stockValues[product.code];
    if (!username || this.saving || !Number.isSafeInteger(stock) || stock < 0) {
      this.errorMessage = 'Količina mora biti nenegativan ceo broj.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.productService.updatePrinterProductStock(product.code, stock, username).subscribe({
      next: updated => {
        this.replaceProduct(updated);
        this.successMessage = 'Količina je sačuvana.';
        this.saving = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Količinu nije moguće sačuvati.';
        this.saving = false;
      }
    });
  }

  addPrintService(): void {
    const username = this.authService.getCurrentUser()?.username;
    const service = this.serviceForm;
    if (!username || !service.productCode || !service.serviceId.trim() || !service.name.trim()
      || service.maxHeightMm === null || !Number.isFinite(service.maxHeightMm) || service.maxHeightMm <= 0
      || service.maxWidthMm === null || !Number.isFinite(service.maxWidthMm) || service.maxWidthMm <= 0
      || !Number.isFinite(service.additionalPricePerItem) || service.additionalPricePerItem < 0 || this.saving) {
      this.errorMessage = 'Popunite sva polja usluge, unesite dimenzije veće od nule i ispravnu cenu.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.productService.addPrintService(service.productCode, {
      serviceId: service.serviceId.trim(), name: service.name.trim(),
      maxHeightMm: service.maxHeightMm, maxWidthMm: service.maxWidthMm,
      additionalPricePerItem: service.additionalPricePerItem
    }, username).subscribe({
      next: updatedProduct => {
        this.replaceProduct(updatedProduct);
        this.cancelAddingService();
        this.successMessage = 'Usluga štampe je dodata.';
        this.saving = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Uslugu štampe nije moguće dodati.';
        this.saving = false;
      }
    });
  }

  removePrintService(product: Product, serviceId: string): void {
    const username = this.authService.getCurrentUser()?.username;
    if (!username || this.saving) return;
    this.saving = true;
    this.productService.removePrintService(product.code, serviceId, username).subscribe({
      next: updatedProduct => {
        this.replaceProduct(updatedProduct);
        this.successMessage = 'Usluga štampe je uklonjena.';
        this.saving = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Uslugu štampe nije moguće ukloniti.';
        this.saving = false;
      }
    });
  }

  importJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const username = this.authService.getCurrentUser()?.username;
    if (!file || !username || this.saving) return;
    file.text().then(text => {
      let products: unknown;
      try { products = JSON.parse(text); } catch { this.errorMessage = 'JSON fajl nije ispravan.'; input.value = ''; return; }
      if (!Array.isArray(products)) { this.errorMessage = 'JSON mora sadržati listu proizvoda.'; input.value = ''; return; }
      this.saving = true;
      this.productService.importPrinterProducts(username, products).subscribe({
        next: response => { this.products = [...this.products, ...response.products]; this.successMessage = `Uvezeno proizvoda: ${response.count}.`; this.saving = false; input.value = ''; },
        error: error => { this.errorMessage = error.error?.message || 'Proizvode nije moguće uvesti.'; this.saving = false; input.value = ''; }
      });
    }).catch(() => { this.errorMessage = 'JSON fajl nije moguće pročitati.'; input.value = ''; });
  }

  private replaceProduct(updatedProduct: Product): void {
    for (let index = 0; index < this.products.length; index++) {
      if (this.products[index].code === updatedProduct.code) this.products[index] = updatedProduct;
    }
  }

  getProductImageUrl(imagePath: string): string {
    return this.productService.getProductImageUrl(imagePath);
  }

  private validForm(): boolean {
    if (!this.form.code.trim() || !this.form.name.trim() || !this.form.category || !this.form.subcategory
      || !Number.isFinite(this.form.unitPrice) || this.form.unitPrice < 0
      || !Number.isSafeInteger(this.form.stock) || this.form.stock < 0) {
      this.errorMessage = 'Popunite obavezna polja i unesite ispravnu cenu i stanje.';
      return false;
    }
    return true;
  }

  private finishCreate(): void {
    this.successMessage = 'Proizvod je dodat.';
    this.selectedProductImage = null;
    this.creating = false;
    this.form = this.emptyForm();
    this.saving = false;
  }

  private emptyForm(): ProductForm {
    return { code: '', name: '', description: '', category: '', subcategory: '', unitPrice: 0, stock: 0, colors: [], colorsText: '', mainImage: '', active: true };
  }

  private emptyServiceForm(): PrintServiceForm {
    return { productCode: '', serviceId: '', name: '', maxHeightMm: null, maxWidthMm: null, additionalPricePerItem: 0 };
  }
}
