import express from 'express'
import {CategoryController} from '../controllers/category.controller';

const categoryRouter = express.Router()

categoryRouter.route("/getAll").get(
     (req, res)=> new CategoryController().getAllCategories(req, res))

categoryRouter.route("/create").post(
    (req, res)=> new CategoryController().createCategory(req, res))

export default categoryRouter;
