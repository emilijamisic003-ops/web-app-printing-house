import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const Schema = mongoose.Schema;

const Order = new Schema({
  invoiceId: { type: String, default: () => 'INV-' + randomUUID() },
  clientUsername: String,
  printingHouseUsername: String,
  items: [{
    _id: false,
    productCode: String,
    productName: String,
    quantity: Number,
    selectedColor: String,
    selectedPrintService: {
      type: new Schema({
        serviceId: String,
        printType: String,
        additionalPricePerItem: Number,
        maxWidthMm: Number,
        maxHeightMm: Number
      }, { _id: false }),
      default: null
    },
    printText: String,
    unitPrice: Number,
    totalPrice: Number
  }],
  totalPrice: Number,
  status: { type: String, enum: ['naručeno', 'u štampi', 'isporučeno', 'primljeno', 'otkazano'], default: 'naručeno' },
  createdAt: { type: Date, default: () => new Date() }
});

export default mongoose.model('OrderModel', Order, 'orders');
