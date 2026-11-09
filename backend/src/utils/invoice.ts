import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import OrderModel from '../models/order';

export async function generateInvoicePdf(
  order: mongoose.InferSchemaType<typeof OrderModel.schema>,
  client: { username?: string | null; firstName?: string | null; lastName?: string | null },
  printer: { username?: string | null; institutionName?: string | null; address?: string | null },
  outputDirectory = path.resolve(__dirname, '../../generated/invoices'),
  showItemPrices = true
) {
  await mkdir(outputDirectory, { recursive: true });
  const filename = order.invoiceId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
  const filePath = path.join(outputDirectory, filename);
  const fonts = path.resolve(__dirname, '../../assets/fonts');
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.registerFont('regular', path.join(fonts, 'LiberationSans-Regular.ttf'));
  doc.registerFont('bold', path.join(fonts, 'LiberationSans-Bold.ttf'));
  const stream = createWriteStream(filePath);
  const completed = new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
  });
  doc.pipe(stream);
  const money = (value: number) => value.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RSD';
  try {
    doc.font('bold').fontSize(24).text('FAKTURA');
    doc.moveDown(0.5).font('regular').fontSize(11);
    doc.text('ID fakture: ' + order.invoiceId);
    doc.text('Datum: ' + order.createdAt.toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' }));
    doc.text('Klijent: ' + (client.username || order.clientUsername));
    doc.text('Ime i prezime: ' + [client.firstName, client.lastName].filter(Boolean).join(' '));
    doc.moveDown();
    doc.text('Štamparija: ' + (printer.institutionName || printer.username || order.printingHouseUsername));
    doc.text('Korisničko ime: ' + (printer.username || order.printingHouseUsername));
    doc.text('Adresa: ' + (printer.address || 'Nije navedena'));
    doc.moveDown();
    order.items.forEach((item, index) => {
      if (doc.y > doc.page.height - 190) doc.addPage();
      doc.font('bold').fontSize(12).text((index + 1) + '. ' + item.productName);
      doc.font('regular').fontSize(10);
      doc.text('Količina: ' + item.quantity + ' | Boja: ' + (item.selectedColor || 'Nije izabrana'));
      doc.text('Tip štampe: ' + (item.selectedPrintService?.printType || item.selectedPrintService?.serviceId || 'Bez dodatne štampe'));
      if (item.printText) doc.text('Tekst za štampu: ' + item.printText);
      if (showItemPrices) {
      doc.text('Osnovna cena po komadu: ' + money(item.unitPrice || 0));
      doc.text('Dodatna cena štampe po komadu: ' + money(item.selectedPrintService?.additionalPricePerItem || 0));
      doc.text('Ukupno za stavku: ' + money(item.totalPrice || 0));
      }
      doc.moveDown();
    });
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.font('bold').fontSize(16).text('UKUPNO: ' + money(order.totalPrice || 0));
    doc.font('regular').fontSize(11).moveDown(0.5).text('Status: ' + order.status);
    doc.end();
    await completed;
  } catch (error) {
    doc.destroy();
    stream.destroy(error instanceof Error ? error : new Error('PDF generation failed'));
    await completed.catch(() => {});
    throw error;
  }
  return { filename, path: filePath };
}
