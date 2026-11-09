import mongoose from 'mongoose';

const CartItem = new mongoose.Schema({
  productCode: String,
  productName: String,
  printingHouseUsername: String,
  quantity: Number,
  selectedColor: String,
  selectedPrintService: mongoose.Schema.Types.Mixed,
  printText: String,
  unitPrice: Number,
  totalPrice: Number
}, { _id: false });

const Cart = new mongoose.Schema({
  clientUsername: { type: String, required: true, unique: true },
  items: { type: [CartItem], default: [] },
  checkingOut: { type: Boolean, default: false },
  updatedAt: { type: Date, default: () => new Date() }
});

export default mongoose.model('CartModel', Cart, 'carts');
