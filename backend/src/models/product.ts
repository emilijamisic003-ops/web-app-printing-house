import mongoose from 'mongoose';

const Schema = mongoose.Schema;

let Product = new Schema({
  code: String,
  name: String,
  description: String,
  category: String,
  subcategory: String,
  unitPrice: Number,
  stock: Number,
  colors: [String],
  mainImage: String,
  additionalImages: [String],
  printingHouseUsername: String,
  likes: Number,
  dislikes: Number,
  active: Boolean,
  printServices: [{
    _id: false,
    serviceId: String,
    printType: String,
    additionalPricePerItem: Number,
    maxWidthMm: Number,
    maxHeightMm: Number
  }]
});

export default mongoose.model('ProductModel', Product, 'products');
