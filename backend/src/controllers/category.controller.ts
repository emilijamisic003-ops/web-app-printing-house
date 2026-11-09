import express from 'express'
import CategoryModel from '../models/category';

export class CategoryController {

  async getAllCategories(_req: express.Request, res: express.Response) {
    try {
      const categories = await CategoryModel.find({ active: true });
      res.json(categories);
    } catch {
      res.status(500).json({ error: 'Greška pri učitavanju kategorija.' });
    }
  }

  async createCategory(req: express.Request, res: express.Response) {
    const name = req.body?.name;
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Naziv kategorije je obavezan.' });
      return;
    }
    try {
      const existingCategory = await CategoryModel.findOne({ name: name.trim() });
      if (existingCategory) {
        res.status(400).json({ message: 'Kategorija već postoji.' });
        return;
      }
      const category = await new CategoryModel({ name: name.trim(), subcategories: [], active: true }).save();
      res.status(201).json(category);
    } catch {
      res.status(400).json({ message: 'Greška pri čuvanju kategorije.' });
    }
  }

  async addSubcategory(req: express.Request, res: express.Response) {
    const name = req.body?.name;
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Naziv potkategorije je obavezan.' });
      return;
    }
    try {
      const category = await CategoryModel.findOne({ name: req.params.categoryName as string });
      if (!category) {
        res.status(404).json({ message: 'Kategorija nije pronađena.' });
        return;
      }
      const subcategory = name.trim();
      if (category.subcategories.includes(subcategory)) {
        res.status(400).json({ message: 'Potkategorija već postoji.' });
        return;
      }
      category.subcategories.push(subcategory);
      await category.save();
      res.json(category);
    } catch {
      res.status(400).json({ message: 'Greška pri čuvanju potkategorije.' });
    }
  }

}