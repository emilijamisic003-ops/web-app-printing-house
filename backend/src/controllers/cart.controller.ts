import express from 'express';
import ProductModel from '../models/product';
import UserModel from '../models/user';
import CartModel from '../models/cart';

export class CartController {


  async getCart(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username as string;
      const cart = await CartModel.findOne({ clientUsername: username }).lean();
      if (!cart) {
        res.json({ clientUsername: username, items: [] });
        return;
      }
      res.json(cart);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju korpe.' });
    }
  }

  async addCartItem(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username as string;
      const item = req.body;
      if (!username.trim() || !item || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        res.status(400).json({ message: 'Podaci nisu ispravni.' });
        return;
      }
      if (typeof item.productCode !== 'string' || typeof item.printingHouseUsername !== 'string' || !await UserModel.exists({ username, role: 'client', active: true, approved: true })) {
        res.status(400).json({ message: 'Klijent i proizvod nisu ispravni.' });
        return;
      }
      const product = await ProductModel.findOne({ code: item.productCode, printingHouseUsername: item.printingHouseUsername, active: true });
      if (!product || item.quantity > (product.stock ?? 0)) {
        res.status(400).json({ message: 'Proizvod nije dostupan u traženoj količini.' });
        return;
      }
      const service = item.selectedPrintService == null ? null
        : product.printServices.find(service => service.serviceId === item.selectedPrintService.serviceId);
      const color = item.selectedColor || '';
      if (typeof color !== 'string' || (product.colors.length ? !product.colors.includes(color) : !!color)
        || service === undefined || !Number.isFinite(product.unitPrice) || product.unitPrice! < 0
        || !Number.isFinite(service?.additionalPricePerItem ?? 0) || (service?.additionalPricePerItem ?? 0) < 0
        || (item.printText != null && typeof item.printText !== 'string')) {
        res.status(400).json({ message: 'Cena, boja ili usluga štampe nisu ispravni.' });
        return;
      }
      const savedItem = { productCode: product.code, productName: product.name,
        printingHouseUsername: product.printingHouseUsername, quantity: item.quantity,
        selectedColor: color, selectedPrintService: service?.toObject() ?? null,
        printText: item.printText || '', unitPrice: product.unitPrice,
        totalPrice: Math.round(item.quantity * (product.unitPrice! + (service?.additionalPricePerItem ?? 0)) * 100) / 100 };
      await CartModel.updateOne({ clientUsername: username }, { $setOnInsert: { clientUsername: username, items: [] } }, { upsert: true });
      const cart = await CartModel.findOneAndUpdate({ clientUsername: username, checkingOut: { $ne: true } },
        { $push: { items: savedItem }, $set: { updatedAt: new Date() } }, { returnDocument: 'after', runValidators: true });
      if (!cart) {
        res.status(409).json({ message: 'Korpa se potvrđuje. Sačekajte završetak.' });
        return;
      }
      res.json(cart);
    } catch {
      res.status(400).json({ message: 'Stavku nije moguće dodati u korpu.' });
    }
  }

  async removeCartItem(req: express.Request, res: express.Response) {
    try {
      const cart = await CartModel.findOne({ clientUsername: req.params.username as string });
      if (!cart) {
        res.status(404).json({ message: 'Korpa nije pronađena.' });
        return;
      }
      const index = Number(req.params.index);
      if (!Number.isInteger(index) || index < 0 || index >= cart.items.length) {
        res.status(400).json({ message: 'Indeks stavke nije ispravan.' });
        return;
      }
      const items = cart.items.toObject();
      items.splice(index, 1);
      const updated = await CartModel.findOneAndUpdate({ _id: cart._id, updatedAt: cart.updatedAt, checkingOut: { $ne: true } },
        { $set: { items, updatedAt: new Date() } }, { returnDocument: 'after' });
      if (!updated) {
        res.status(409).json({ message: 'Korpa je promenjena ili se potvrđuje. Osvežite korpu.' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(400).json({ message: 'Stavku nije moguće ukloniti iz korpe.' });
    }
  }

  async clearCart(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username as string;
      const cart = await CartModel.findOneAndUpdate({ clientUsername: username, checkingOut: { $ne: true } }, { $set: { items: [], updatedAt: new Date() } }, { returnDocument: 'after' });
      if (!cart && await CartModel.exists({ clientUsername: username, checkingOut: true })) {
        res.status(409).json({ message: 'Korpa se potvrđuje. Sačekajte završetak.' });
        return;
      }
      res.json(cart || { clientUsername: username, items: [] });
    } catch {
      res.status(500).json({ message: 'Korpu nije moguće isprazniti.' });
    }
  }


}