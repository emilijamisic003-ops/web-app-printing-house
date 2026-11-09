import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, CategoryService } from '../../services/category.service';

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.css'
})
export class AdminCategories implements OnInit {
  private categoryService = inject(CategoryService);
  categories: Category[] = [];
  categoryName = '';
  subcategoryNames: Record<string, string> = {};
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.errorMessage = '';
    this.categoryService.getAllCategories().subscribe({
      next: categories => {
        this.categories = categories;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || error.error?.error || 'Kategorije trenutno nije moguće učitati.';
        this.loading = false;
      }
    });
  }

  addCategory(): void {
    const name = this.categoryName.trim();
    if (!name || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.categoryService.createCategory(name).subscribe({
      next: category => {
        this.categories.push(category);
        this.categoryName = '';
        this.successMessage = 'Kategorija je dodata.';
        this.saving = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || error.error?.error || 'Kategoriju nije moguće dodati.';
        this.saving = false;
      }
    });
  }

  addSubcategory(category: Category): void {
    const name = (this.subcategoryNames[category.name] || '').trim();
    if (!name || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.categoryService.addSubcategory(category.name, name).subscribe({
      next: updatedCategory => {
        for (let index = 0; index < this.categories.length; index++) {
          if (this.categories[index].name === updatedCategory.name) this.categories[index] = updatedCategory;
        }
        this.subcategoryNames[category.name] = '';
        this.successMessage = 'Potkategorija je dodata.';
        this.saving = false;
      },
      error: error => {
        this.errorMessage = error.error?.message || 'Potkategoriju nije moguće dodati.';
        this.saving = false;
      }
    });
  }
}
