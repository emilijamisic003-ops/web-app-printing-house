import mongoose from 'mongoose';

const Reaction = new mongoose.Schema({
  productCode: { type: String, required: true },
  username: { type: String, required: true },
  invoiceId: { type: String, required: true },
  reaction: { type: String, enum: ['like', 'dislike'], required: true },
  createdAt: { type: Date, default: () => new Date() }
});

Reaction.index({ productCode: 1, username: 1, invoiceId: 1 }, { unique: true });

export default mongoose.model('ReactionModel', Reaction, 'reactions');