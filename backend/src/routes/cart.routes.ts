import express from 'express';
import { CartController } from '../controllers/cart.controller';

const cartRouter = express.Router();
const controller = new CartController();

cartRouter.get('/:username',
    (req, res) => controller.getCart(req, res));

cartRouter.post('/:username/items',
    (req, res) => controller.addCartItem(req, res));

cartRouter.delete('/:username/items/:index',
    (req, res) => controller.removeCartItem(req, res));

cartRouter.delete('/:username',
    (req, res) => controller.clearCart(req, res));

export default cartRouter;
