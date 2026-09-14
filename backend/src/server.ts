import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import productRouter from './routes/product.routes'
import categoryRouter from './routes/category.routes'
import userRouter from './routes/user.routes'

const app = express()
app.use(cors())
app.use(express.json())

/*
mongoose.connect('mongodb://127.0.0.1:27017/printing_house')
  .then(() => console.log('MongoDB connected to printing_house'))
  .catch((error) => console.error('MongoDB connection error:', error))

app.use('/products', productRouter)
app.use('/categories', categoryRouter)

app.get('/', (req, res)=> {res.send("Hello world!")})
app.listen(4000, ()=>console.log("Express running on port 4000!"))

*/
mongoose.connect("mongodb://127.0.0.1:27017/printing_house");

const connection = mongoose.connection;
connection.once("open", () => {
    console.log("Connected to MongoDB on port 27017");
})

const router = express.Router()
router.use("/products", productRouter)
router.use("/categories", categoryRouter)
router.use("/users", userRouter)
//console.log("rebuild");
app.use("/", router)
app.listen(4000, ()=>console.log("Express running on port 4000!"))
