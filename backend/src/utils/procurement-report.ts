import PDFDocument from 'pdfkit';
import path from 'path';

export async function generateProcurementReport(procurement: {
  procurementId: string;
  clientUsername: string;
  createdAt: Date;
  expiresAt: Date;
  offers: { printingHouseUsername: string; totalPrice: number; createdAt: Date }[];
  winningPrintingHouseUsername?: string | null;
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const fonts = path.resolve(__dirname, '../../assets/fonts');
  try {
    doc.registerFont('regular', path.join(fonts, 'LiberationSans-Regular.ttf'));
    doc.registerFont('bold', path.join(fonts, 'LiberationSans-Bold.ttf'));
    const money = (value: number) => value.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RSD';
    const date = (value: Date) => new Date(value).toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' });
    doc.font('bold').fontSize(22).text('Izveštaj o javnoj nabavci');
    doc.moveDown(.6).font('regular').fontSize(11);
    doc.text('Nabavka: ' + procurement.procurementId);
    doc.text('Klijent: ' + procurement.clientUsername);
    doc.text('Raspisana: ' + date(procurement.createdAt));
    doc.text('Rok: ' + date(procurement.expiresAt));
    doc.moveDown();
    doc.font('bold').fontSize(14).text('Primljene ponude');
    doc.moveDown(.5);
    const offers = [...procurement.offers].sort((a, b) => a.totalPrice - b.totalPrice);
    for (const offer of offers) {
      const winner = offer.printingHouseUsername === procurement.winningPrintingHouseUsername;
      const label = offer.printingHouseUsername + (winner ? ' - POBEDNIK' : '');
      doc.font('bold').fontSize(11);
      const height = doc.heightOfString(label, { width: 490 }) + 58;
      if (doc.y + height > doc.page.height - 75) doc.addPage();
      doc.fillColor(winner ? '#174e42' : '#222222').text(label, { width: 490 });
      doc.font('regular').fillColor('#222222').text('Ukupna cena: ' + money(offer.totalPrice));
      doc.text('Datum ponude: ' + date(offer.createdAt));
      doc.moveDown(.8);
    }
    if (!offers.length) doc.font('regular').fontSize(11).text('Nema primljenih ponuda.');
    if (doc.y > doc.page.height - 155) doc.addPage();
    doc.moveDown().font('bold').fontSize(14).text('Ishod nabavke');
    const winner = offers.find(offer => offer.printingHouseUsername === procurement.winningPrintingHouseUsername);
    doc.font('regular').fontSize(11);
    if (winner) {
      doc.text('Pobednička štamparija: ' + winner.printingHouseUsername);
      doc.text('Pobednička ukupna cena: ' + money(winner.totalPrice));
    } else doc.text('Nije pronađena validna ponuda.');
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('regular').fontSize(9).fillColor('#666666').text(`${index + 1} / ${range.count}`, 48, 795,
        { width: 499, align: 'right', lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
    return await completed;
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error('PDF generation failed'));
    await completed.catch(() => {});
    throw error;
  }
}
