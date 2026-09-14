import express from 'express'
import { ProductController } from '../controllers/product.controller';

const productRouter = express.Router()

productRouter.route("/getAll").get(
  (req, res) => new ProductController().getAllProducts(req, res)
)

productRouter.route("/getTop").get(
  (req, res) => new ProductController().getTopProducts(req, res)
)

productRouter.route("/create").post(
  (req, res) => new ProductController().createProduct(req, res)
)

export default productRouter;
