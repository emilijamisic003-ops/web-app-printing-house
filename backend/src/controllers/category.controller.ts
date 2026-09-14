import express from 'express'
import CategoryModel from '../models/category';

export class CategoryController {

  getAllCategories = (req: express.Request, res: express.Response) => {
    CategoryModel.find({ active: true }).then((categories) => {
      res.json(categories);
    }).catch(() => {
      res.status(500).json({ error: 'Greška pri učitavanju kategorija.' });
    });
  }

  createCategory = (req: express.Request, res: express.Response) => {
    const category = new CategoryModel(req.body);

    category.save().then((savedCategory) => {
      res.status(201).json(savedCategory);
    }).catch(() => {
      res.status(400).json({ error: 'Greška pri čuvanju kategorije.' });
    });
  }

}