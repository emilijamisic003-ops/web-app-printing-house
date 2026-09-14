import express from 'express'
import ProductModel from '../models/product';

export class ProductController {
  createProduct = (req: express.Request, res: express.Response) => {
    const product = new ProductModel(req.body);

    product.save().then((savedProduct) => {
      res.status(201).json(savedProduct);
    }).catch(() => {
      console.log('Error on save product');
      res.status(400).json({ error: 'Greška pri čuvanju proizvoda.' });
    });
  }

  getAllProducts = (req: express.Request, res: express.Response) => {
    ProductModel.find({ active: true }).then((products) => {
      res.json(products);
    }).catch(() => {
      console.log('Error on find all active products');
      res.status(500).json({ error: 'Greška pri učitavanju proizvoda.' });
    });
  }

  getTopProducts = (req: express.Request, res: express.Response) => {
    ProductModel.find({ active: true })
      .sort({ likes: -1 })
      .limit(5).then((products) => {
        res.json(products);
      }).catch(() => {
        console.log('Error on find top products');
        res.status(500).json({ error: 'Greška pri učitavanju najomiljenijih proizvoda.' });
      });
  }
}
