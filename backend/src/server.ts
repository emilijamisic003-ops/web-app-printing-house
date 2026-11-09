import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import path from 'path'
import productRouter from './routes/product.routes'
import categoryRouter from './routes/category.routes'
import userRouter from './routes/user.routes'
import orderRouter from './routes/order.routes'
import commentRouter from './routes/comment.routes'
import cartRouter from './routes/cart.routes'
import procurementRouter from './routes/procurement.routes'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads/profiles', express.static(path.resolve(__dirname, '../uploads/profiles')))
app.use('/images/products', express.static(path.resolve(__dirname, '../../frontend/public/images/products')))

mongoose.connect("mongodb://127.0.0.1:27017/printing_house");

const connection = mongoose.connection;
connection.once("open", () => {
    console.log("Connected to MongoDB on port 27017");
})

const router = express.Router()
router.use("/products", productRouter)
router.use("/categories", categoryRouter)
router.use("/users", userRouter)
router.use('/orders', orderRouter)
router.use('/comments', commentRouter)
router.use('/carts', cartRouter)
router.use('/procurements', procurementRouter)
app.use("/", router)


app.listen(4000, ()=>console.log("Express running on port 4000!-new"))
