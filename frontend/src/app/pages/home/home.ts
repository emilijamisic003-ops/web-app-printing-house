import { Component, inject, OnInit } from '@angular/core';
import { Product, ProductService } from '../../services/product.service';
import { UserService } from '../../services/user.service';
import { CategoryService } from '../../services/category.service';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  readonly searchOnly = inject(ActivatedRoute).snapshot.data['searchOnly'] === true;
  private productService = inject(ProductService);
  private userService = inject(UserService);
  private categoryService = inject(CategoryService);
  private searchRequest?: Subscription;

  searchForm = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    price: new FormControl('', { nonNullable: true })
  });
  categories: { name: string }[] = [];
  categoriesError = '';
  searchResults: Product[] = [];
  searchLoading = false;
  searchError = '';
  sortDirection: '' | 'asc' | 'desc' = '';

  printingHouseCount: number | null = null;
  topProducts: Product[] = [];
  countLoading = true;
  productsLoading = true;
  countError = '';
  productsError = '';
  searchSubmitted = false;

  ngOnInit(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => this.categories = categories,
      error: () => this.categoriesError = 'Kategorije trenutno nisu dostupne. Možete pretraživati po nazivu.'
    });
    if (this.searchOnly) return;

    this.userService.getPrintingHouseCount().subscribe({
      next: (data) => {
        this.printingHouseCount = data.count;
        this.countLoading = false;
      },
      error: () => {
        this.countError = 'Broj štamparija trenutno nije dostupan. Pokušajte ponovo kasnije.';
        this.countLoading = false;
      }
    });

    this.productService.getTopProducts().subscribe({
      next: (products) => {
        this.topProducts = products;
        this.productsLoading = false;
      },
      error: () => {
        this.productsError = 'Proizvodi trenutno nisu dostupni. Pokušajte ponovo kasnije.';
        this.productsLoading = false;
      }
    });
  }

  search(): void {
    this.searchRequest?.unsubscribe();
    this.searchSubmitted = true;
    this.searchLoading = true;
    this.searchError = '';
    this.searchResults = [];
    const { name, category, price} = this.searchForm.getRawValue();
    this.searchRequest = this.productService.searchProducts(name, category, this.sortDirection).subscribe({
      next: (products) => {
        if (price || Number.isInteger(price) || Number(price) != 0){
          this.searchResults = products.filter(product => product.unitPrice <= Number(price));
        }
        else{
          this.searchResults = products;
        }
        this.searchLoading = false;
      },
      error: () => {
        this.searchError = 'Pretraga trenutno nije dostupna. Pokušajte ponovo kasnije.';
        this.searchLoading = false;
      }
    });
  }

  get sortAccessibilityLabel(): string {
    if (this.sortDirection === 'asc') return 'ascending';
    if (this.sortDirection === 'desc') return 'descending';
    return 'none';
  }

  get sortMark(): string {
    if (this.sortDirection === 'asc') return '↑';
    if (this.sortDirection === 'desc') return '↓';
    return '↕';
  }

  toggleSort(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.search();
  }
}
