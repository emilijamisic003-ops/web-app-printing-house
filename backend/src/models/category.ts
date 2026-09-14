import mongoose from 'mongoose';

const Schema = mongoose.Schema;

let Category = new Schema({
  name: String,
  subcategories: [String],
  active: Boolean
});

export default mongoose.model('CategoryModel', Category, 'categories');
