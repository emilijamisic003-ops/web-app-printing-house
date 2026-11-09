import mongoose from 'mongoose';

const Comment = new mongoose.Schema({
  productCode: { type: String, required: true },
  username: { type: String, required: true },
  invoiceId: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() }
});

Comment.index({ productCode: 1, username: 1, invoiceId: 1 }, { unique: true });

export default mongoose.model('CommentModel', Comment, 'comments');