import mongoose from 'mongoose';

const Schema = mongoose.Schema;

let User = new Schema({
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  profileImage: { type: String, required: true },
  role: { type: String, required: true },
  clientType: String,
  institutionName: String,
  address: String,
  registrationNumber: String,
  pib: String,
  approved: { type: Boolean, required: true },
  active: { type: Boolean, required: true }
});

export default mongoose.model('UserModel', User, 'users');
