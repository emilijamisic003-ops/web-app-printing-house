import express from 'express';
import mongoose from 'mongoose';
import OrderModel from '../models/order';
import ProductModel from '../models/product';
import UserModel from '../models/user';
import { generateInvoicePdf } from '../utils/invoice';
import ReactionModel from '../models/reaction';
import CartModel from '../models/cart';
import CommentModel from '../models/comment';

export class OrderController {

  async confirmOrder(req: express.Request, res: express.Response) {
    const orders: InstanceType<typeof OrderModel>[] = [];
    const decreasedStock: { id: mongoose.Types.ObjectId; quantity: number }[] = [];
    let ordersSaved = false;
    let cart: InstanceType<typeof CartModel> | null = null;
    try {
      const { clientUsername } = req.body ?? {};
      if (typeof clientUsername !== 'string' || !clientUsername.trim()) {
        res.status(400).json({ message: 'Klijent i stavke korpe su obavezni.' });
        return;
      }
      const client = await UserModel.findOne({ username: clientUsername, role: 'client', active: true, approved: true });
      if (!client || client.clientType === 'legal') {
        res.status(400).json({ message: 'Nije pronađen individualni klijent.' });
        return;
      }

      // Samo jedan zahtev može potvrđivati sačuvanu korpu.
      cart = await CartModel.findOneAndUpdate({ clientUsername, checkingOut: { $ne: true }, 'items.0': { $exists: true } },
        { $set: { checkingOut: true } }, { returnDocument: 'after' });
      if (!cart) {
        res.status(409).json({ message: 'Korpa je prazna ili se već potvrđuje. Osvežite korpu.' });
        return;
      }
      const items = cart.items;

      // Proveravamo sve stavke pre bilo kakvog upisa, uključujući ponovljene proizvode.
      const quantities = new Map<string, number>();
      for (const item of items) {
        if (!item || typeof item.productCode !== 'string' || !item.productCode.trim()
          || typeof item.printingHouseUsername !== 'string' || !item.printingHouseUsername.trim()
          || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
          || (item.selectedPrintService != null && (typeof item.selectedPrintService !== 'object'
            || typeof item.selectedPrintService.serviceId !== 'string'))
          || (item.printText != null && typeof item.printText !== 'string')) {
          res.status(400).json({ message: 'Stavke korpe nisu ispravne.' });
          return;
        }
        const productKey = JSON.stringify([item.printingHouseUsername, item.productCode]);
        quantities.set(productKey, (quantities.get(productKey) || 0) + item.quantity!);
      }
      const products = await ProductModel.find({
        active: true,
        $or: items.map(item => ({ code: item.productCode, printingHouseUsername: item.printingHouseUsername }))
      });
      const productByKey = new Map<string, InstanceType<typeof ProductModel>>();
      for (const product of products) {
        const productKey = JSON.stringify([product.printingHouseUsername, product.code]);
        productByKey.set(productKey, product);
      }
      for (const [productKey, quantity] of quantities) {
        const product = productByKey.get(productKey);
        if (!product) {
          res.status(400).json({ message: 'Proizvod nije dostupan kod izabrane štamparije.' });
          return;
        }
        if (!Number.isFinite(product.stock) || quantity > (product.stock ?? 0) || quantity > 20) {
          res.status(400).json({ message: 'Nema dovoljno proizvoda trenutno na stanju' });
          return;
        }
      }

      const grouped = new Map<string, InstanceType<typeof OrderModel>>();
      for (const item of items) {
        const productKey = JSON.stringify([item.printingHouseUsername, item.productCode]);
        const product = productByKey.get(productKey)!;
        const printerUsername = product.printingHouseUsername;
        const selectedColor = item.selectedColor || '';
        const selectedService = item.selectedPrintService == null ? null
          : product.printServices.find(service => service.serviceId === item.selectedPrintService.serviceId);
        if (!printerUsername || typeof selectedColor !== 'string'
          || (product.colors.length && !product.colors.includes(selectedColor))
          || (!product.colors.length && selectedColor)
          || selectedService === undefined
          || !Number.isFinite(product.unitPrice) || (product.unitPrice ?? -1) < 0
          || !Number.isFinite(selectedService?.additionalPricePerItem ?? 0)
          || (selectedService?.additionalPricePerItem ?? 0) < 0) {
          res.status(400).json({ message: 'Cena, boja ili usluga štampe nisu ispravni.' });
          return;
        }
        let order = grouped.get(printerUsername);
        if (!order) {
          order = new OrderModel({ clientUsername, printingHouseUsername: printerUsername, items: [], totalPrice: 0 });
          grouped.set(printerUsername, order);
        }
        const unitPrice = Math.round(product.unitPrice! * 100) / 100;
        const additionalPrice = Math.round((selectedService?.additionalPricePerItem ?? 0) * 100) / 100;
        const itemTotal = Math.round(item.quantity! * (unitPrice + additionalPrice) * 100) / 100;
        if (!Number.isFinite(itemTotal)) {
          res.status(400).json({ message: 'Iznos stavke nije ispravan.' });
          return;
        }
        order.items.push({ productCode: product.code, productName: product.name, quantity: item.quantity,
          selectedColor, selectedPrintService: selectedService?.toObject() ?? null,
          printText: item.printText || '', unitPrice, totalPrice: itemTotal });
        order.totalPrice = Math.round(((order.totalPrice || 0) + itemTotal) * 100) / 100;
      }
      const printers = await UserModel.find({ username: { $in: Array.from(grouped.keys()) }, role: 'printer', active: true });
      const printerByUsername = new Map<string, InstanceType<typeof UserModel>>();
      for (const printer of printers) {
        printerByUsername.set(printer.username, printer);
      }
      for (const username of Array.from(grouped.keys())) {
        if (!printerByUsername.has(username)) {
          res.status(400).json({ message: 'Štamparija više nije dostupna.' });
          return;
        }
      }
      for (const order of Array.from(grouped.values())) {
        orders.push(order);
      }
      for (const order of orders) await order.validate();

      // Atomsko umanjenje sprečava negativno stanje pri istovremenim potvrdama.
      // Ako neki upis ne uspe, u catch bloku poništavamo ovu potvrdu.
      for (const order of orders) await order.save();
      for (const [productKey, quantity] of quantities) {
        const product = productByKey.get(productKey)!;
        const result = await ProductModel.updateOne({ _id: product._id, active: true, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } });
        if (result.modifiedCount !== 1) throw new Error('INSUFFICIENT_STOCK');
        decreasedStock.push({ id: product._id, quantity });
      }
      ordersSaved = true;
      await CartModel.updateOne({ _id: cart._id }, { $set: { items: [], checkingOut: false, updatedAt: new Date() } });

      // Greška PDF-a ne poništava već sačuvane porudžbine.
      let warning = '';
      try {
        for (const order of orders) {
          await generateInvoicePdf(order, client, printerByUsername.get(order.printingHouseUsername!)!);
        }
      } catch (error) {
        console.error('Fakture nisu generisane:', error instanceof Error ? error.message : 'Nepoznata greška');
        warning = 'Narudžbina je kreirana, ali PDF fakture nisu generisane. Ne potvrđujte korpu ponovo; kontaktirajte podršku.';
      }
      res.status(201).json({ message: 'Narudžbina je uspešno kreirana.', orders, warning });
    } catch (error) {
      if (!ordersSaved) {
        try {
          if (orders.length) await OrderModel.deleteMany({ _id: { $in: orders.map(order => order._id) } });
          for (const item of decreasedStock) await ProductModel.updateOne({ _id: item.id }, { $inc: { stock: item.quantity } });
        } catch (rollbackError) {
          console.error('Poništavanje potvrde nije uspelo:', rollbackError);
          res.status(500).json({ message: 'Proverite porudžbine na profilu pre ponovnog pokušaja. Kontaktirajte podršku.' });
          return;
        }
      }
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
        res.status(400).json({ message: 'Nema dovoljno proizvoda trenutno na stanju' });
      } else {
        console.error('Potvrda porudžbine nije uspela:', error);
        res.status(500).json({ message: 'Narudžbinu trenutno nije moguće kreirati.' });
      }
    } finally {
      if (cart && !ordersSaved) {
        await CartModel.updateOne({ _id: cart._id }, { $set: { checkingOut: false } });
      }
    }
  }

  async createOrder(req: express.Request, res: express.Response) {
    // Stara ruta koristi iste provere kao potvrda korpe.
    return this.confirmOrder(req, res);
  }

  async getOrdersByClient(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username;
      const orders = await OrderModel.find({ clientUsername: username }).lean();
      res.json(orders);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju porudžbina.' });
    }
  }

  async getOrdersByPrinter(req: express.Request, res: express.Response) {
    try {
      const orders = await OrderModel.find({ printingHouseUsername: req.params.username as string })
        .sort({ createdAt: -1 }).lean();
      res.json(orders);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju porudžbina štamparije.' });
    }
  }

  async updatePrinterOrderStatus(req: express.Request, res: express.Response) {
    const nextStatus = req.body?.status;
    const transitions: Record<string, string> = {
      'naručeno': 'u štampi',
      'u štampi': 'isporučeno'
    };
    try {
      const order = await OrderModel.findOne({ invoiceId: req.params.invoiceId as string });
      if (!order) {
        res.status(404).json({ message: 'Porudžbina nije pronađena.' });
        return;
      }
      if (transitions[order.status] !== nextStatus) {
        res.status(400).json({ message: 'Nije dozvoljen prelazak porudžbine u izabrani status.' });
        return;
      }
      const updated = await OrderModel.findOneAndUpdate({ _id: order._id, status: order.status },
        { $set: { status: nextStatus } }, { returnDocument: 'after' });
      if (!updated) {
        res.status(409).json({ message: 'Status porudžbine je promenjen. Osvežite listu.' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ message: 'Greška pri promeni statusa porudžbine.' });
    }
  }

  async getClientArchive(req: express.Request, res: express.Response) {
    try {
      const orders = await OrderModel.find({
        clientUsername: req.params.username,
        status: { $in: ['isporučeno', 'primljeno'] }
      }).lean();
      const username = req.params.username as string;
      const productCodes: string[] = [];
      for (const order of orders) {
        for (const item of order.items) {
          if (typeof item.productCode === 'string' && item.productCode && !productCodes.includes(item.productCode)) {
            productCodes.push(item.productCode);
          }
        }
      }
      const reactions = await ReactionModel.find({ username, productCode: { $in: productCodes } }).lean();
      const comments = await CommentModel.find({ username, productCode: { $in: productCodes } }).lean();
      // Par proizvod/faktura razlikuje ponovljene kupovine istog proizvoda.
      const reactedItems = new Set<string>();
      for (const reaction of reactions) {
        reactedItems.add(JSON.stringify([reaction.productCode, reaction.invoiceId]));
      }
      const commentedItems = new Set<string>();
      for (const comment of comments) {
        commentedItems.add(JSON.stringify([comment.productCode, comment.invoiceId]));
      }
      const archive = [];
      for (const order of orders) {
        for (const item of order.items) {
          const productCode = item.productCode || '';
          const key = JSON.stringify([productCode, order.invoiceId]);
          archive.push({
            invoiceId: order.invoiceId,
            createdAt: order.createdAt,
            productCode,
            productName: item.productName,
            quantity: item.quantity,
            printingHouseUsername: order.printingHouseUsername,
            status: order.status,
            hasReacted: reactedItems.has(key),
            hasCommented: commentedItems.has(key)
          });
        }
      }
      res.json(archive);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju arhive proizvoda.' });
    }
  }

  async markOrderReceived(req: express.Request, res: express.Response) {
    try {
      const order = await OrderModel.findOne({ invoiceId: req.params.invoiceId });
      if (!order || order.status !== 'isporučeno') {
        res.status(400).json({ message: 'Porudžbina nije spremna za potvrdu prijema.' });
        return;
      }
      const updated = await OrderModel.findOneAndUpdate({ _id: order._id, status: 'isporučeno' },
        { $set: { status: 'primljeno' } }, { returnDocument: 'after' });
      if (!updated) {
        res.status(409).json({ message: 'Prijem je već potvrđen.' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ message: 'Greška pri potvrdi prijema porudžbine.' });
    }
  }

  async cancelOrder(req: express.Request, res: express.Response) {
    let order: InstanceType<typeof OrderModel> | null = null;
    const restored: { id: mongoose.Types.ObjectId; quantity: number }[] = [];
    try {
      // order = await OrderModel.findOneAndUpdate({ invoiceId: req.params.invoiceId, status:  'naručeno' },
      //   { $set: { status: 'otkazano' } }, { returnDocument: 'after' });
      console.log('PARAM:', req.params.invoiceId);
      order = await OrderModel.findOne({invoiceId: req.params.invoiceId, status: { $in: ['naručeno', 'u štampi'] }});
      if (!order) {
        res.status(400).json({ message: 'Porudžbina ne postoji ili više ne može da se otkaže.' });
        return;
      }
      const d1 = new Date(order.createdAt);
      const d2 = Date.now();

      const dif = d2 - d1.getTime();

      if(order.status == 'u štampi' && dif > 10*60*1000){
        res.status(400).json({
          message: 'Porudžbina u štampi može da se otkaže samo u prvih 10 minuta.'});
        return;
      }
      await OrderModel.findOneAndUpdate({ invoiceId: req.params.invoiceId, status: { $in: ['naručeno', 'u štampi'] } },
      { $set: { status: 'otkazano' } }, { returnDocument: 'after' });
      for (const item of order.items) {
        const product = await ProductModel.findOneAndUpdate({ code: item.productCode, printingHouseUsername: order.printingHouseUsername },
          { $inc: { stock: item.quantity } }, { returnDocument: 'after' });
        if (!product) throw new Error('Proizvod za vraćanje stanja nije pronađen.');
        restored.push({ id: product._id, quantity: item.quantity! });
      }
      res.json(order);
    } catch (error) {
      for (const item of restored) await ProductModel.updateOne({ _id: item.id }, { $inc: { stock: -item.quantity } });
      if (order) await OrderModel.updateOne({ _id: order._id, status: 'otkazano' }, { $set: { status: 'naručeno' } });
      res.status(500).json({ message: 'Greška pri otkazivanju porudžbine.' });
    }
  }

}
