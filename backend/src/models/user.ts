import mongoose from 'mongoose';

const Schema = mongoose.Schema;

let User = new Schema({
  username: { type: String, required: true, trim: true, unique: true },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, trim: true, unique: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  profileImage: { type: String, required: true },
  role: { type: String, required: true },
  clientType: String,
  institutionName: String,
  address: String,
  registrationNumber: { type: String, match: /^\d{8}$/, set: (value: string | null) => value?.trim() || undefined },
  pib: { type: String, match: /^[1-9]\d{8}$/, set: (value: string | null) => value?.trim() || undefined },
  approved: { type: Boolean, required: true },
  active: { type: Boolean, required: true }
});

// Only non-empty identifiers participate; individual clients may omit them.
User.index({ registrationNumber: 1 }, { unique: true, partialFilterExpression: { registrationNumber: { $type: 'string', $gt: '' } } });
User.index({ pib: 1 }, { unique: true, partialFilterExpression: { pib: { $type: 'string', $gt: '' } } });

export default mongoose.model('UserModel', User, 'users');
