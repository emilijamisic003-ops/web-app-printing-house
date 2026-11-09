import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const Procurement = new mongoose.Schema({
  procurementId: { type: String, required: true, default: () => 'JN-' + randomUUID() },
  clientUsername: { type: String, required: true },
  items: [{
    _id: false,
    productCode: String,
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    selectedColor: String,
    selectedPrintService: mongoose.Schema.Types.Mixed,
    printText: String
  }],
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'finished'], default: 'active' },
  offers: [{
    _id: false,
    printingHouseUsername: { type: String, required: true },
    totalPrice: { type: Number, required: true, min: 0.01 },
    createdAt: { type: Date, default: () => new Date() }
  }],
  winningPrintingHouseUsername: { type: String, default: null },
  invoiceId: String,
  invoiceWarning: String,
  processing: { type: Boolean, default: false, select: false }
});
// The partial index permits preserving older documents until migration is run.
Procurement.index({ procurementId: 1 }, { unique: true, partialFilterExpression: { procurementId: { $type: 'string' } } });
export default mongoose.model('ProcurementModel', Procurement, 'procurements');
