import express from 'express'
import {CategoryController} from '../controllers/category.controller';

const categoryRouter = express.Router()
const controller = new CategoryController();

categoryRouter.get("/getAll",
     (req, res)=> controller.getAllCategories(req, res))

categoryRouter.post("/create",
    (req, res)=> controller.createCategory(req, res))

categoryRouter.post('/:categoryName/subcategories',
    (req, res) => controller.addSubcategory(req, res))

export default categoryRouter;
