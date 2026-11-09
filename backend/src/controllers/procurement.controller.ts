import express from 'express';
import ProcurementModel from '../models/procurement';
import CartModel from '../models/cart';
import OrderModel from '../models/order';
import ProductModel from '../models/product';
import UserModel from '../models/user';
import { sendBrevoEmail } from '../utils/brevo-mail';
import { generateInvoicePdf } from '../utils/invoice';
import { generateProcurementReport } from '../utils/procurement-report';

type Procurement = InstanceType<typeof ProcurementModel>;

function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}

// Sabiramo količine za isti naziv, čak i kada su konfiguracije različite.
export function requiredQuantities(items: { productName: string; quantity: number }[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const name = normalizeProductName(item.productName);
    if (!name) throw new Error('Naziv proizvoda je obavezan.');
    const total = (quantities.get(name) || 0) + item.quantity;
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(total)) {
      throw new Error('Neispravna količina.');
    }
    quantities.set(name, total);
  }
  return quantities;
}

// Ista provera važi za prikaz, slanje ponude i izbor pobednika.
async function findPrinterProductsForProcurement(username: string, quantities: Map<string, number>) {
  if (!quantities.size) return null;
  const products = await ProductModel.find({ printingHouseUsername: username, active: true }).sort({ code: 1 });
  const byName = new Map<string, InstanceType<typeof ProductModel>>();
  for (const [name, quantity] of Array.from(quantities)) {
    const product = products.find(product => product.code && normalizeProductName(product.name || '') === name
      && Number.isFinite(product.stock) && (product.stock ?? -1) >= quantity);
    if (!product) return null;
    byName.set(name, product);
  }
  return byName;
}

async function notifyPrinters(procurement: Procurement): Promise<boolean> {
  let emailSent = true;
  try {
    const printers = await UserModel.find({ role: 'printer', approved: true, active: true });
    const recipients = printers.filter(printer => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((printer.email || '').trim()));
    const subject = 'Otvorena nova javna nabavka - ' + procurement.procurementId;
    const textContent = `Otvorena je nova javna nabavka ${procurement.procurementId}.\n\nTraženi proizvodi:\n`
      + procurement.items.map(item => `- ${item.productName} - ${item.quantity} komada`).join('\n')
      + '\n\nLicitacija traje 10 minuta.\n\nRok za dostavljanje ponuda:\n'
      + procurement.expiresAt.toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' })
      + '\n\nPrijavite se na sistem kako biste pregledali javnu nabavku i poslali ponudu.';
    const results = await Promise.allSettled(recipients.map(printer => sendBrevoEmail(
      printer.email.trim(), printer.institutionName || printer.username, subject, textContent
    )));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        emailSent = false;
        // Do not log raw errors, which may contain request headers or credentials.
        console.error('Greška pri slanju obaveštenja štampariji:', recipients[index].username,
          'Brevo slanje nije uspelo. Proverite konfiguraciju i dostupnost servisa.');
      }
    });
  } catch {
    emailSent = false;
    console.error('Obaveštenja o novoj javnoj nabavci nije moguće poslati.');
  }
  return emailSent;
}

export async function confirmProcurement(req: express.Request, res: express.Response) {
  let procurement: Procurement | undefined;
  let confirmed = false;
  try {
    const { clientUsername } = req.body ?? {};
    if (typeof clientUsername !== 'string' || !clientUsername.trim()) {
      res.status(400).json({ message: 'Klijent je obavezan.' });
      return;
    }
    const client = await UserModel.findOne({ username: clientUsername, role: 'client', clientType: 'legal', active: true, approved: true });
    if (!client) {
      res.status(403).json({ message: 'Javne nabavke su dostupne samo pravnim klijentima.' });
      return;
    }
    const cart = await CartModel.findOne({ clientUsername });
    if (!cart?.items.length) {
      res.status(400).json({ message: 'Korpa je prazna.' });
      return;
    }
    const items = [];
    for (const item of cart.items) {
      if (!item.productCode || !Number.isSafeInteger(item.quantity) || item.quantity! <= 0) {
        res.status(400).json({ message: 'Stavke korpe nisu ispravne.' });
        return;
      }
      const product = await ProductModel.findOne({ code: item.productCode, printingHouseUsername: item.printingHouseUsername, active: true });
      if (!product?.name) {
        res.status(400).json({ message: 'Proizvod nije dostupan: ' + item.productCode });
        return;
      }
      items.push({ productCode: item.productCode, productName: product.name, quantity: item.quantity!,
        selectedColor: item.selectedColor, selectedPrintService: item.selectedPrintService, printText: item.printText });
    }
    requiredQuantities(items);
    const createdAt = new Date();
    procurement = await new ProcurementModel({ clientUsername, items, createdAt,
      expiresAt: new Date(createdAt.getTime() + 600000), status: 'active' }).save();
    // Clear only the exact cart we read; a concurrent edit/confirmation must not lose items.
    const cleared = await CartModel.updateOne({ _id: cart._id, items: cart.items, updatedAt: cart.updatedAt },
      { $set: { items: [], updatedAt: new Date() } });
    if (cleared.modifiedCount !== 1) {
      await ProcurementModel.deleteOne({ _id: procurement._id });
      res.status(409).json({ message: 'Korpa je u međuvremenu promenjena. Osvežite korpu.' });
      return;
    }
    confirmed = true;
    const emailSent = await notifyPrinters(procurement);
    const warning = emailSent ? '' : 'Javna nabavka je kreirana, ali obaveštenje nije poslato svim štamparijama.';
    res.status(201).json({ message: 'Javna nabavka je uspešno raspisana.', procurement, emailSent, warning });
  } catch {
    if (procurement && !confirmed) await ProcurementModel.deleteOne({ _id: procurement._id });
    res.status(500).json({ message: 'Javnu nabavku nije moguće sačuvati.' });
  }
}

export async function createOffer(req: express.Request, res: express.Response) {
  let locked: Procurement | null = null;
  try {
    const { printingHouseUsername, totalPrice } = req.body ?? {};
    const cents = Math.round(totalPrice * 100);
    if (typeof printingHouseUsername !== 'string' || !printingHouseUsername.trim()
      || typeof totalPrice !== 'number' || !Number.isFinite(totalPrice) || totalPrice <= 0
      || !Number.isSafeInteger(cents) || cents <= 0) {
      res.status(400).json({ message: 'Unesite štampariju i ukupnu cenu veću od nule.' });
      return;
    }
    const printer = await UserModel.findOne({ username: printingHouseUsername, role: 'printer', active: true, approved: true });
    if (!printer) {
      res.status(403).json({ message: 'Štamparija nije dostupna.' });
      return;
    }
    const existing = await ProcurementModel.findOne({ procurementId: req.params.id });
    if (!existing) {
      res.status(404).json({ message: 'Javna nabavka nije pronađena.' });
      return;
    }
    if (existing.offers.some(offer => offer.printingHouseUsername === printingHouseUsername)) {
      res.status(400).json({ message: 'Već ste poslali ponudu za ovu javnu nabavku.' });
      return;
    }
    locked = await ProcurementModel.findOneAndUpdate({ procurementId: req.params.id, status: 'active',
      expiresAt: { $gt: new Date() }, processing: { $ne: true } }, { $set: { processing: true } }, { returnDocument: 'after' });
    if (!locked) {
      res.status(409).json({ message: 'Nabavka je istekla ili se trenutno obrađuje. Osvežite listu.' });
      return;
    }
    // Re-check after the atomic claim so simultaneous requests cannot save two offers.
    if (locked.offers.some(offer => offer.printingHouseUsername === printingHouseUsername)) {
      res.status(400).json({ message: 'Već ste poslali ponudu za ovu javnu nabavku.' });
      return;
    }
    if (!await findPrinterProductsForProcurement(printingHouseUsername, requiredQuantities(locked.items))) {
      res.status(400).json({ message: 'Štamparija nema sve tražene proizvode ili dovoljnu količinu na stanju.' });
      return;
    }
    if (locked.expiresAt.getTime() <= Date.now()) {
      res.status(400).json({ message: 'Rok za ponude je istekao.' });
      return;
    }
    const offer = { printingHouseUsername, totalPrice: cents / 100, createdAt: new Date() };
    locked.offers.push(offer);
    await locked.save();
    res.status(201).json(offer);
  } catch {
    res.status(500).json({ message: 'Ponudu nije moguće sačuvati.' });
  } finally {
    if (locked) await ProcurementModel.updateOne({ _id: locked._id }, { $set: { processing: false } });
  }
}

export async function finalizeProcurement(id: string) {
  // MongoDB claim prevents two page requests from creating two winning orders.
  const procurement = await ProcurementModel.findOneAndUpdate({ procurementId: id, status: 'active',
    expiresAt: { $lte: new Date() }, processing: { $ne: true } }, { $set: { processing: true } }, { returnDocument: 'after' });
  if (!procurement) return;
  try {
    const quantities = requiredQuantities(procurement.items);
    const offers = procurement.offers.slice();
    offers.sort((first, second) => {
      const priceDifference = first.totalPrice - second.totalPrice;
      if (priceDifference !== 0) return priceDifference;
      return first.createdAt.getTime() - second.createdAt.getTime();
    });
    for (const offer of offers) {
      const printer = await UserModel.findOne({ username: offer.printingHouseUsername, role: 'printer', active: true, approved: true });
      if (!printer) continue;
      const byName = await findPrinterProductsForProcurement(offer.printingHouseUsername, quantities);
      if (!byName) continue;
      const orderItems = [];
      for (const item of procurement.items) {
        const product = byName.get(normalizeProductName(item.productName))!;
        const orderItem = item.toObject();
        orderItem.productCode = product.code;
        orderItem.productName = product.name!;
        orderItems.push(orderItem);
      }
      const order = new OrderModel({
        clientUsername: procurement.clientUsername,
        printingHouseUsername: offer.printingHouseUsername,
        status: 'u štampi',
        totalPrice: offer.totalPrice,
        items: orderItems
      });
      const decreased: { id: typeof order._id; quantity: number }[] = [];
      let completed = false;
      try {
        await order.save();
        for (const [name, quantity] of Array.from(quantities)) {
          const product = byName.get(name)!;
          const result = await ProductModel.updateOne({ _id: product._id, printingHouseUsername: offer.printingHouseUsername,
            active: true, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
          if (result.modifiedCount !== 1) throw new Error('STOCK_CHANGED');
          decreased.push({ id: product._id, quantity });
        }
        await ProcurementModel.updateOne({ _id: procurement._id }, { $set: {
          status: 'finished', winningPrintingHouseUsername: offer.printingHouseUsername, invoiceId: order.invoiceId } });
        completed = true;
      } catch (error) {
        for (const item of decreased) await ProductModel.updateOne({ _id: item.id }, { $inc: { stock: item.quantity } });
        await OrderModel.deleteOne({ _id: order._id });
        if (error instanceof Error && error.message === 'STOCK_CHANGED') continue;
        throw error;
      }
      if (completed) {
        try {
          const client = await UserModel.findOne({ username: procurement.clientUsername });
          await generateInvoicePdf(order, client || {}, printer, undefined, false);
        } catch {
          await ProcurementModel.updateOne({ _id: procurement._id }, { $set: {
            invoiceWarning: 'Porudžbina je kreirana, ali PDF fakture nije generisan.' } });
        }
        return;
      }
    }
    await ProcurementModel.updateOne({ _id: procurement._id }, { $set: { status: 'finished', winningPrintingHouseUsername: null } });
  } finally {
    await ProcurementModel.updateOne({ _id: procurement._id }, { $set: { processing: false } });
  }
}

export async function finalizeClientProcurements(username: string) {
  const expired = await ProcurementModel.find({ clientUsername: username, status: 'active', expiresAt: { $lte: new Date() } });
  for (const procurement of expired) await finalizeProcurement(procurement.procurementId);
}

export async function getClientProcurements(req: express.Request, res: express.Response) {
  try {
    const username = req.params.username as string;
    const client = await UserModel.findOne({ username, role: 'client', clientType: 'legal', active: true, approved: true });
    if (!client) {
      res.status(403).json({ message: 'Javne nabavke su dostupne samo pravnim klijentima.' });
      return;
    }
    await finalizeClientProcurements(username);
    const procurements = await ProcurementModel.find({ clientUsername: username }).sort({ createdAt: -1 }).lean();
    for (const procurement of procurements) {
      procurement.offers.sort((first, second) => first.totalPrice - second.totalPrice);
    }
    res.json(procurements);
  } catch {
    res.status(500).json({ message: 'Javne nabavke nije moguće učitati ili završiti. Pokušajte ponovo.' });
  }
}

export async function getActiveProcurements(req: express.Request, res: express.Response) {
  try {
    const username = req.params?.username ?? req.query.printingHouseUsername;
    if (typeof username !== 'string' || !await UserModel.exists({ username, role: 'printer', active: true, approved: true })) {
      res.status(403).json({ message: 'Pristup je dozvoljen štamparijama.' });
      return;
    }
    const procurements = await ProcurementModel.find({ status: 'active', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
    const eligible = [];
    for (const procurement of procurements) {
      if (await findPrinterProductsForProcurement(username, requiredQuantities(procurement.items))) {
        // Printers only need their submission state, not competitors' prices.
        const { offers, ...details } = procurement;
        eligible.push({ ...details, offers: [], hasOffer: offers.some(offer => offer.printingHouseUsername === username) });
      }
    }
    res.json(eligible);
  } catch {
    res.status(500).json({ message: 'Aktivne nabavke nije moguće učitati.' });
  }
}

export async function getProcurementReport(req: express.Request, res: express.Response) {
  try {
    const username = req.query.clientUsername;
    if (typeof username !== 'string' || !await UserModel.exists({ username, role: 'client', clientType: 'legal', active: true, approved: true })) {
      res.status(403).json({ message: 'Pristup je dozvoljen pravnom klijentu.' });
      return;
    }
    const procurement = await ProcurementModel.findOne({ procurementId: req.params.id, clientUsername: username }).lean();
    if (!procurement) {
      res.status(404).json({ message: 'Javna nabavka nije pronađena.' });
      return;
    }
    if (procurement.status !== 'finished') {
      res.status(400).json({ message: 'Izveštaj je dostupan nakon završetka nabavke.' });
      return;
    }
    const pdf = await generateProcurementReport(procurement);
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + procurement.procurementId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf"');
    res.send(pdf);
  } catch {
    res.status(500).json({ message: 'PDF izveštaj nije moguće generisati.' });
  }
}
