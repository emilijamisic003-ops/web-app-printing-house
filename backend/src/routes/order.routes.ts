import express from 'express';
import { OrderController } from '../controllers/order.controller';

const orderRouter = express.Router();
const controller = new OrderController();

orderRouter.post('/create',
    (req, res) => controller.createOrder(req, res));

orderRouter.post('/confirm',
    (req, res) => controller.confirmOrder(req, res));

orderRouter.get('/client/:username',
    (req, res) => controller.getOrdersByClient(req, res));

orderRouter.get('/printer/:username',
    (req, res) => controller.getOrdersByPrinter(req, res));

orderRouter.get('/client/:username/archive',
    (req, res) => controller.getClientArchive(req, res));

orderRouter.put('/:invoiceId/status',
    (req, res) => controller.updatePrinterOrderStatus(req, res));

orderRouter.put('/:invoiceId/received',
    (req, res) => controller.markOrderReceived(req, res));

orderRouter.put('/:invoiceId/cancel',
    (req, res) => controller.cancelOrder(req, res));

export default orderRouter;
