import express from 'express';
import CommentModel from '../models/comment';
import ProductModel from '../models/product';
import UserModel from '../models/user';
import OrderModel from '../models/order';

export class CommentController {

    async createComment(req: express.Request, res: express.Response) {
        try {
            const { productCode, username, invoiceId, text } = req.body ?? {};
            if (typeof productCode !== 'string' || !productCode.trim() || typeof username !== 'string' || !username.trim() || typeof invoiceId !== 'string' || !invoiceId.trim() || typeof text !== 'string' || !text.trim()) {
                res.status(400).json({ message: 'Proizvod, korisnik, faktura i tekst komentara su obavezni.' });
                return;
            }
            const user = await UserModel.findOne({ username, role: 'client' });
            const receivedOrder = await OrderModel.findOne({invoiceId, clientUsername: username, status: 'primljeno', 'items.productCode': productCode});
            if (!user) {
                res.status(400).json({ message: 'Korisnik ili proizvod nisu pronađeni.' });
                return;
            }
            if (!receivedOrder) {
                res.status(400).json({ message: 'Komentar možete ostaviti samo za primljeni proizvod.' });
                return;
            }
            const product = await ProductModel.findOne({ code: productCode, printingHouseUsername: receivedOrder.printingHouseUsername });
            if (!product) {
                res.status(404).json({ message: 'Proizvod nije pronađen.' });
                return;
            }
            const existingComment = await CommentModel.findOne({ productCode, username, invoiceId });
            if (existingComment) {
                res.status(400).json({ message: 'Već ste ostavili komentar za ovaj proizvod iz ove porudžbine.' });
                return;
            }
            let comment;
            try {
                comment = await new CommentModel({ productCode, username, invoiceId, text: text.trim() }).save();
            } catch (error) {
                if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
                    res.status(400).json({ message: 'Već ste ostavili komentar za ovaj proizvod iz ove porudžbine.' });
                    return;
                }
                throw error;
            }
            res.status(201).json(comment);
        } catch {
            res.status(500).json({ message: 'Komentar trenutno nije moguće sačuvati.' });
        }
    }

    async getCommentsByProduct(req: express.Request, res: express.Response) {
    try {
        const printingHouseUsername = req.query.printingHouseUsername;
        if (typeof printingHouseUsername !== 'string' || !printingHouseUsername.trim()) {
            res.status(400).json({ message: 'Štamparija je obavezna.' });
            return;
        }
        const orders = await OrderModel.find({ printingHouseUsername, 'items.productCode': req.params.productCode }).select('invoiceId');
        const invoiceIds = orders.map(order => order.invoiceId);
        const comments = await CommentModel.find({ productCode: req.params.productCode, invoiceId: { $in: invoiceIds } }).select('-invoiceId').sort({ createdAt: -1 }).lean();
        res.json(comments);
    } catch {
        res.status(500).json({ message: 'Komentare trenutno nije moguće učitati.' });
    }
    }
}