import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CategoryService {

  private http = inject(HttpClient);

  getAllCategories() {
    return this.http.get<Category[]>('http://localhost:4000/categories/getAll');
  }

  createCategory(name: string) {
    return this.http.post<Category>('http://localhost:4000/categories/create', { name });
  }

  addSubcategory(categoryName: string, name: string) {
    return this.http.post<Category>('http://localhost:4000/categories/' + encodeURIComponent(categoryName) + '/subcategories', { name });
  }
}

export interface Category {
  _id?: string;
  name: string;
  subcategories: string[];
}
