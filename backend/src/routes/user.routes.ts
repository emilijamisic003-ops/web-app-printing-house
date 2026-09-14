import express from 'express'
import {UserController} from '../controllers/user.controller';

const userRouter = express.Router()

userRouter.route("/getAll").get(
    (req, res) => new UserController().getAllUsers(req, res))

userRouter.route("/register").post(
    (req, res) => new UserController().registerUser(req, res))

userRouter.route("/login").post(
    (req, res) => new UserController().loginUser(req, res))

export default userRouter;
