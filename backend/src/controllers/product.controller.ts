import express from 'express'
import ProductModel from '../models/product';
import UserModel from '../models/user';
import OrderModel from '../models/order';
import ReactionModel from '../models/reaction';
import { unlink } from 'fs/promises';

export class ProductController {

  async getProductByCode(req: express.Request, res: express.Response) {
    try {
      const code = req.params.code as string;
      const printingHouseUsername = req.query.printingHouseUsername;
      const filter: { code: string; active: boolean; printingHouseUsername?: string } = { code, active: true };
      if (printingHouseUsername !== undefined) {
        if (typeof printingHouseUsername !== 'string' || !printingHouseUsername.trim()) {
          res.status(400).json({ message: 'Štamparija nije ispravna.' });
          return;
        }
        filter.printingHouseUsername = printingHouseUsername.trim();
      }
      const products = await ProductModel.find(filter).limit(2);
      if (products.length === 0) {
        res.status(404).json({ message: 'Proizvod nije pronađen' });
        return;
      }
      if (products.length > 1) {
        res.status(400).json({ message: 'Navedite štampariju za izabrani proizvod.' });
        return;
      }
      res.json(products[0]);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju proizvoda.' });
    }
  }

  async searchProducts(req: express.Request, res: express.Response) {
    try {
      const { name, category, sort } = req.query;
      const filter: {
        active: boolean;
        stock: { $gt: number };
        name?: { $regex: string; $options: string };
        category?: string;
      } = { active: true, stock: { $gt: 0 } };

      if (typeof name === 'string' && name.trim()) {
        const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.name = { $regex: escapedName, $options: 'i' };
      }
      if (typeof category === 'string' && category && category !== 'all') {
        filter.category = category;
      }

      const query = ProductModel.find(filter);
      if (sort === 'asc') query.sort({ name: 1 });
      if (sort === 'desc') query.sort({ name: -1 });

      const products = await query;
      res.json(products);
    } catch {
      res.status(500).json({ error: 'Greška pri pretrazi proizvoda.' });
    }
  }

  async reactToProduct(req: express.Request, res: express.Response) {
    try {
      const code = req.params.code as string;
      const { username, invoiceId, reaction } = req.body ?? {};
      if (typeof username !== 'string' || !username.trim()
        || typeof invoiceId !== 'string' || !invoiceId.trim()) {
        res.status(400).json({ message: 'Korisnik i faktura su obavezni.' });
        return;
      }
      if (req.body.productCode !== undefined && req.body.productCode !== code) {
        res.status(400).json({ message: 'Proizvod se ne podudara sa zahtevom.' });
        return;
      }
      if (reaction !== 'like' && reaction !== 'dislike') {
        res.status(400).json({ message: 'Reakcija mora biti like ili dislike.' });
        return;
      }
      const [user, receivedOrder, existingReaction] = await Promise.all([
        UserModel.findOne({ username, role: 'client' }),
        OrderModel.findOne({ invoiceId, clientUsername: username, status: 'primljeno', 'items.productCode': code }),
        ReactionModel.findOne({ username, productCode: code, invoiceId })
      ]);
      if (existingReaction) {
        res.status(400).json({ message: 'Već ste ocenili ovaj proizvod iz ove porudžbine.' });
        return;
      }
      if (!user || !receivedOrder) {
        res.status(400).json({ message: 'Reakciju možete ostaviti samo za primljeni proizvod.' });
        return;
      }
      const product = await ProductModel.findOne({ code, printingHouseUsername: receivedOrder.printingHouseUsername });
      if (!product) {
        res.status(404).json({ message: 'Proizvod nije pronađen.' });
        return;
      }
      try {
        await new ReactionModel({ productCode: code, username, invoiceId, reaction }).save();
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 11000) {
          res.status(400).json({ message: 'Već ste ocenili ovaj proizvod iz ove porudžbine.' });
          return;
        }
        throw error;
      }
      const updated = await ProductModel.findOneAndUpdate(
        { _id: product._id }, { $inc: { [reaction === 'like' ? 'likes' : 'dislikes']: 1 } }, { new: true });
      res.json({ likes: updated?.likes ?? 0, dislikes: updated?.dislikes ?? 0 });
    } catch {
      res.status(500).json({ message: 'Reakciju trenutno nije moguće sačuvati.' });
    }
  }

  getPrinterUsername(req: express.Request): string | null {
    const username = req.body?.printingHouseUsername || req.header('x-printer-username');
    return typeof username === 'string' && username.trim() ? username.trim() : null;
  }

  validStock(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
  }

  productFieldsAreValid(data: any, requireCode: boolean): boolean {
    return Boolean(data) && (!requireCode || typeof data.code === 'string')
      && typeof data.name === 'string'
      && typeof data.description === 'string'
      && typeof data.category === 'string'
      && typeof data.subcategory === 'string'
      && typeof data.unitPrice === 'number' && Number.isFinite(data.unitPrice) && data.unitPrice >= 0
      && this.validStock(data.stock)
      && Array.isArray(data.colors) && data.colors.every((color: unknown) => typeof color === 'string')
      && typeof data.mainImage === 'string'
      && typeof data.active === 'boolean';
  }

 async getProductsByPrinter(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username as string;
      const printer = await UserModel.findOne({ username, role: 'printer' });
      if (!printer) {
        res.status(404).json({ message: 'Štamparija nije pronađena.' });
        return;
      }
      const products = await ProductModel.find({ printingHouseUsername: username }).lean();
      res.json(products);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju proizvoda.' });
    }
  }

  async createPrinterProduct(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    const data = req.body;
    if (!username || !this.productFieldsAreValid(data, true)) {
      res.status(400).json({ message: 'Podaci proizvoda nisu ispravni.' });
      return;
    }
    try {
      const printer = await UserModel.findOne({ username, role: 'printer' });
      if (!printer) {
        res.status(403).json({ message: 'Samo štamparija može dodavati proizvode.' });
        return;
      }
      if (await ProductModel.findOne({ code: data.code, printingHouseUsername: username })) {
        res.status(400).json({ message: 'Šifra proizvoda već postoji.' });
        return;
      }
      const product = await new ProductModel({
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category,
        subcategory: data.subcategory,
        unitPrice: data.unitPrice,
        stock: data.stock,
        colors: data.colors,
        mainImage: data.mainImage,
        active: data.active,
        printingHouseUsername: username,
        likes: 0,
        dislikes: 0,
        additionalImages: []
      }).save();
      res.status(201).json(product);
    } catch {
      res.status(400).json({ message: 'Proizvod nije moguće sačuvati.' });
    }
  }

  async updatePrinterProduct(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    const data = req.body;
    if (!username || !this.productFieldsAreValid(data, false)) {
      res.status(400).json({ message: 'Podaci proizvoda nisu ispravni.' });
      return;
    }
    try {
      const product = await ProductModel.findOne({ code: req.params.code as string });
      if (!product) {
        res.status(404).json({ message: 'Proizvod nije pronađen.' });
        return;
      }
      if (product.printingHouseUsername !== username) {
        res.status(403).json({ message: 'Nemate dozvolu za izmenu ovog proizvoda.' });
        return;
      }
      const updated = await ProductModel.findOneAndUpdate(
        { code: req.params.code as string, printingHouseUsername: username },
        { $set: {
          name: data.name, description: data.description, category: data.category,
          subcategory: data.subcategory, unitPrice: data.unitPrice, stock: data.stock,
          colors: data.colors, mainImage: data.mainImage, active: data.active
        } },
        { new: true, runValidators: true }
      );
      res.json(updated);
    } catch {
      res.status(400).json({ message: 'Proizvod nije moguće izmeniti.' });
    }
  }

  async updatePrinterProductStock(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    const stock = req.body?.stock;
    if (!username || !Number.isSafeInteger(stock) || stock < 0) {
      res.status(400).json({ message: 'Količina mora biti nenegativan ceo broj.' });
      return;
    }
    try {
      const product = await ProductModel.findOne({ code: req.params.code as string });
      if (!product) {
        res.status(404).json({ message: 'Proizvod nije pronađen.' });
        return;
      }
      if (product.printingHouseUsername !== username) {
        res.status(403).json({ message: 'Nemate dozvolu za izmenu ovog proizvoda.' });
        return;
      }
      product.stock = stock;
      await product.save();
      res.json(product);
    } catch {
      res.status(400).json({ message: 'Količinu proizvoda nije moguće sačuvati.' });
    }
  }

  async uploadPrinterProductImage(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    try {
      const product = await ProductModel.findOne({ code: req.params.code as string });
      if (!product) {
        if (req.file) await unlink(req.file.path).catch(() => {});
        res.status(404).json({ message: 'Proizvod nije pronađen.' });
        return;
      }
      if (typeof username !== 'string' || product.printingHouseUsername !== username) {
        if (req.file) await unlink(req.file.path).catch(() => {});
        res.status(403).json({ message: 'Nemate dozvolu za izmenu ovog proizvoda.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: 'Slika nije poslata.' });
        return;
      }
      product.mainImage = '/images/products/' + req.file.filename;
      await product.save();
      res.json(product);
    } catch {
      if (req.file) await unlink(req.file.path).catch(() => {});
      res.status(500).json({ message: 'Slika proizvoda nije moguće sačuvati.' });
    }
  }

  async addPrinterPrintService(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    const { serviceId, name, maxDimensions, additionalPricePerItem } = req.body ?? {};
    if (!username || typeof serviceId !== 'string' || !serviceId.trim()
      || typeof name !== 'string' || !name.trim()
      || typeof maxDimensions !== 'string'
      || typeof additionalPricePerItem !== 'number' || !Number.isFinite(additionalPricePerItem)
      || additionalPricePerItem < 0) {
      res.status(400).json({ message: 'Podaci usluge štampe nisu ispravni.' });
      return;
    }
    try {
      const product = await ProductModel.findOne({ code: req.params.code as string });
      if (!product) {
        res.status(404).json({ message: 'Proizvod nije pronađen.' });
        return;
      }
      if (product.printingHouseUsername !== username) {
        res.status(403).json({ message: 'Nemate dozvolu za izmenu ovog proizvoda.' });
        return;
      }
      if ((product.printServices || []).some(service => service.serviceId === serviceId.trim())) {
        res.status(400).json({ message: 'Usluga štampe već postoji.' });
        return;
      }
      product.printServices.push({
        serviceId: serviceId.trim(),
        name: name.trim(),
        maxDimensions: maxDimensions.trim(),
        printType: name.trim(),
        additionalPricePerItem
      });
      await product.save();
      res.json(product);
    } catch {
      res.status(400).json({ message: 'Uslugu štampe nije moguće sačuvati.' });
    }
  }

  async removePrinterPrintService(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    try {
      const product = await ProductModel.findOne({ code: req.params.code as string });
      if (!product) {
        res.status(404).json({ message: 'Proizvod nije pronađen.' });
        return;
      }
      if (product.printingHouseUsername !== username) {
        res.status(403).json({ message: 'Nemate dozvolu za izmenu ovog proizvoda.' });
        return;
      }
      const serviceIndex = product.printServices.findIndex(service => service.serviceId === req.params.serviceId);
      if (serviceIndex === -1) {
        res.status(404).json({ message: 'Usluga štampe nije pronađena.' });
        return;
      }
      product.printServices.splice(serviceIndex, 1);
      await product.save();
      res.json(product);
    } catch {
      res.status(400).json({ message: 'Uslugu štampe nije moguće obrisati.' });
    }
  }

  async importPrinterProducts(req: express.Request, res: express.Response) {
    const username = this.getPrinterUsername(req);
    const products = req.body?.products;
    if (!username || !Array.isArray(products)) {
      res.status(400).json({ message: 'Štamparija i lista proizvoda su obavezni.' });
      return;
    }
    try {
      const printer = await UserModel.findOne({ username, role: 'printer' });
      if (!printer) {
        res.status(403).json({ message: 'Samo štamparija može uvoziti proizvode.' });
        return;
      }
      const codes = products.map(product => product?.code);
      if (products.some(product => !this.productFieldsAreValid(product, true) || !product.code.trim())
        || new Set(codes).size !== codes.length) {
        res.status(400).json({ message: 'Svi proizvodi moraju imati ispravne i jedinstvene šifre.' });
        return;
      }
      const existing = await ProductModel.find({ code: { $in: codes } }).select('code').lean();
      if (existing.length) {
        res.status(400).json({ message: 'Jedan ili više proizvoda sa tom šifrom već postoje.' });
        return;
      }
      const documents = products.map(product => ({
        code: product.code.trim(), name: product.name.trim(), description: product.description || '',
        category: product.category.trim(), subcategory: product.subcategory || '',
        unitPrice: product.unitPrice, stock: product.stock, colors: product.colors,
        mainImage: product.mainImage || '', printingHouseUsername: username, active: product.active ?? true,
        likes: 0, dislikes: 0, additionalImages: [], printServices: []
      }));
      const importedProducts = await ProductModel.insertMany(documents);
      res.status(201).json({ count: importedProducts.length, products: importedProducts });
    } catch {
      res.status(400).json({ message: 'Proizvode nije moguće uvesti.' });
    }
  }


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
