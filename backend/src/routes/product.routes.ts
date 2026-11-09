import express from 'express'
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { isProductImage } from '../utils/image-validation';
import { ProductController } from '../controllers/product.controller';

const productRouter = express.Router()
const controller = new ProductController();


const productImagesDir = path.resolve(__dirname, '../../../frontend/public/images/products');
fs.mkdirSync(productImagesDir, { recursive: true });
const productImageUpload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, productImagesDir),
    filename: (req, file, callback) => {
      const code = String(req.params.code || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
      const extension = file.mimetype === 'image/jpeg' ? '.jpg' : file.mimetype === 'image/png' ? '.png' : '.gif';
      callback(null, `${code}-${Date.now()}-${randomUUID()}${extension}`);
    }
  }),
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
      callback(new Error('Dozvoljene su samo JPG, PNG i GIF slike.'));
      return;
    }
    callback(null, true);
  }
});

productRouter.get('/search',
  (req, res) => controller.searchProducts(req, res)
);

productRouter.get("/getAll",
  (req, res) => controller.getAllProducts(req, res)
);

productRouter.get("/getTop",
  (req, res) => controller.getTopProducts(req, res)
);

productRouter.post("/create",
  (req, res) => controller.createProduct(req, res)
);

productRouter.get('/printer/:username',
  (req, res) => controller.getProductsByPrinter(req, res)
);

productRouter.post('/printer/create', 
  (req, res) => controller.createPrinterProduct(req, res)
);

productRouter.post('/printer/import',
  (req, res) => controller.importPrinterProducts(req, res)
);

productRouter.put('/printer/:code/stock',
  (req, res) => controller.updatePrinterProductStock(req, res)
);

productRouter.put('/printer/:code/image',
  (req, res) => {
    productImageUpload.single('productImage')(req, res, async error => {
      if (error) {
        res.status(400).json({ message: 'Pošaljite JPG, PNG ili GIF sliku do 5 MB.' });
        return;
      }
      if (req.file && !isProductImage(req.file.path)) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        res.status(400).json({ message: 'Fajl nije ispravna JPG, PNG ili GIF slika.' });
        return;
      }
      void controller.uploadPrinterProductImage(req, res);
    });
});

productRouter.post('/printer/:code/print-services',
  (req, res) => controller.addPrinterPrintService(req, res)
);
productRouter.delete('/printer/:code/print-services/:serviceId',
  (req, res) => controller.removePrinterPrintService(req, res)
);

productRouter.post('/:code/reaction',
  (req, res) => controller.reactToProduct(req, res)
);

productRouter.get('/:code',
  (req, res) => controller.getProductByCode(req, res)
);

export default productRouter;
