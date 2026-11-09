import express from 'express'
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {UserController} from '../controllers/user.controller';
import { hasAllowedProfileImageDimensions } from '../utils/image-validation';

const userRouter = express.Router()
const controller = new UserController();

userRouter.post('/forgot-password', (req, res) => controller.forgotPassword(req, res));
userRouter.post('/reset-password', (req, res) => controller.resetPassword(req, res));


userRouter.get("/getAll",
    (req, res) => controller.getAllUsers(req, res))

userRouter.post("/register",(req, res) => {
    profileImageUpload.single('profileImage')(req, res, async (error) => {
        if (error) {
            res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE'
                ? 'Slika ne sme biti veća od 5 MB.' : 'Pošaljite jednu JPG, PNG ili GIF sliku do 5 MB.' });
            return;
        }
        if (req.file && !hasAllowedProfileImageDimensions(req.file.path)) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            res.status(400).json({ message: 'Dimenzije slike moraju biti između 100x100 i 250x250 px.' });
            return;
        }
        void controller.registerUser(req, res);
    });
})

userRouter.post("/login",
    (req, res) => controller.loginUser(req, res))

userRouter.post("/admin-login",
    (req, res) => controller.adminLogin(req, res))

userRouter.get('/admin/all',
    (req, res) => controller.getAdminUsers(req, res))

userRouter.get('/admin/pending',
    (req, res) => controller.getPendingAdminUsers(req, res))
   
userRouter.put('/admin/:username/approve',
    (req, res) => controller.approveAdminUser(req, res))

userRouter.delete('/admin/:username/reject',
    (req, res) => controller.rejectAdminUser(req, res))

userRouter.put('/admin/:username',
    (req, res) => controller.updateAdminUser(req, res))

userRouter.delete('/admin/:username',
    (req, res) => controller.deleteAdminUser(req, res))

userRouter.get("/printing-houses/count",
    (req, res) => controller.getPrintingHouseCount(req, res))

userRouter.get('/printer/:username',
    (req, res) => controller.getPrinterByUsername(req, res))

userRouter.put('/:username/profile-image',
    (req, res) => {
        profileImageUpload.single('profileImage')(req, res, async (error) => {
            if (error) {
                res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE'
                    ? 'Slika ne sme biti veća od 5 MB.' : 'Pošaljite jednu JPG, PNG ili GIF sliku do 5 MB.' });
                return;
            }
            if (!req.file || !hasAllowedProfileImageDimensions(req.file.path)) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                res.status(400).json({ message: req.file
                    ? 'Dimenzije slike moraju biti između 100x100 i 250x250 px.'
                    : 'Pošaljite jednu JPG, PNG ili GIF sliku do 5 MB.' });
                return;
            }
            void controller.uploadProfileImage(req, res);
    });
})

userRouter.get("/:username",
    (req, res) => controller.getUserByUsername(req, res))

userRouter.put("/:username",
    (req, res) => controller.updateUser(req, res))



const profileImagesDir = path.resolve(__dirname, '../../uploads/profiles');
fs.mkdirSync(profileImagesDir, { recursive: true });

const profileImageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profileImagesDir),
    filename: (_req, file, cb) => {
        const extension = file.mimetype === 'image/jpeg' ? '.jpg' : file.mimetype === 'image/png' ? '.png' : '.gif';
        cb(null, `${randomUUID()}${extension}`);
    }
});

const profileImageUpload = multer({
    storage: profileImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error('Dozvoljene su samo JPG, PNG i GIF slike.'));
            return;
        }
        cb(null, true);
    }
});


export default userRouter;
