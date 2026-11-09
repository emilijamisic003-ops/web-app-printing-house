import express from 'express';
import { CommentController } from '../controllers/comment.controller';

const commentRouter = express.Router();
const controller = new CommentController();

commentRouter.post('/',
    (req, res) => controller.createComment(req, res));

commentRouter.get('/product/:productCode',
    (req, res) => controller.getCommentsByProduct(req, res));

export default commentRouter;