import { finalizeClientProcurements } from './procurement.controller';
import express from 'express'
import UserModel from '../models/user';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendBrevoEmail } from '../utils/brevo-mail';
import { unlink } from 'fs/promises';


export class UserController {

  async forgotPassword(req: express.Request, res: express.Response) {
    const identifier = req.body?.identifier;
    if (typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ message: 'Unesite korisničko ime ili email adresu.' });
    }
    const message = 'Ako postoji nalog sa unetim podacima, link za promenu lozinke je poslat na email.';
    try {
      const user = await UserModel.findOne({ $or: [{ username: identifier.trim() }, { email: identifier.trim() }] });
      if (!user) return res.status(200).json({ message });

      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();
      const resetLink = 'http://localhost:4200/reset-password?token=' + token;
      try {
        await sendBrevoEmail(user.email, user.firstName, 'Promena lozinke',
          'Zatražena je promena lozinke za vaš nalog.\n\n'
          + 'Kliknite na sledeći link da postavite novu lozinku:\n\n' + resetLink
          + '\n\nLink važi 5 minuta.\n\nAko niste poslali ovaj zahtev, ignorišite poruku.');
      } catch {
        return res.status(500).json({ message: 'Greška pri slanju email poruke.' });
      }
      return res.status(200).json({ message });
    } catch {
      return res.status(500).json({ message: 'Greška pri obradi zahteva za promenu lozinke.' });
    }
  }

  async resetPassword(req: express.Request, res: express.Response) {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ message: 'Link nije ispravan ili je istekao.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 12
      || !new RegExp('^(?=.*\\p{Lu})(?=.*[0-9])(?=.*[\\p{P}\\p{S}])\\p{L}.*$', 'u').test(password)) {
      return res.status(400).json({ message: 'Lozinka mora imati 8–12 karaktera, počinjati slovom i sadržati veliko slovo, broj i specijalni karakter.' });
    }
    try {
      const user = await UserModel.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
      if (!user) return res.status(400).json({ message: 'Link nije ispravan ili je istekao.' });
      const passwordHash = await bcrypt.hash(password, 10);
      // Provera i uklanjanje tokena u istom upisu sprečavaju dvostruko korišćenje linka.
      const result = await UserModel.updateOne({ _id: user._id, resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } }, {
        $set: { passwordHash },
        $unset: { resetPasswordToken: '', resetPasswordExpires: '' }
      });
      if (result.modifiedCount !== 1) return res.status(400).json({ message: 'Link nije ispravan ili je istekao.' });
      return res.status(200).json({ message: 'Lozinka je uspešno promenjena.' });
    } catch {
      return res.status(500).json({ message: 'Greška pri promeni lozinke.' });
    }
  }


  async uploadProfileImage(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username;

      if (!req.file) {
        res.status(400).json({ message: 'Slika nije poslata.' });
        return;
      }

      const profileImage = '/uploads/profiles/' + req.file.filename;
      const user = await UserModel.findOneAndUpdate({ username }, { $set: { profileImage } }, { new: true, runValidators: true }).select('-passwordHash');

      if (!user) {
        await unlink(req.file.path).catch(() => {});
        res.status(404).json({ message: 'Korisnik nije pronađen.' });
        return;
      }

      res.status(200).json({message: 'Profilna slika je uspešno promenjena.', user});
    } catch (error) {
      if (req.file) await unlink(req.file.path).catch(() => {});
      res.status(500).json({ message: 'Greška pri čuvanju profilne slike.' });
    }
  }

  async getPrinterByUsername(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username;
      const printer = await UserModel.findOne({ username, role: 'printer', active: true })
        .select('-passwordHash');

      if (!printer) {
        res.status(404).json({ message: 'Štamparija nije pronađena' });
        return;
      }

      res.status(200).json(printer);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju štamparije.' });
    }
  }

  async adminLogin(req: express.Request, res: express.Response) {

    const data = req.body;

    if (!data || typeof data.username !== 'string' || !data.username.trim() || typeof data.password !== 'string' || !data.password) {
      res.status(401).json();
      return;
    }

    try {
      const user = await UserModel.findOne({ username: data.username, role: 'admin', active: true });
      if (!user || !await bcrypt.compare(data.password, user.passwordHash)) {
        res.status(401).json({ message: 'Pogrešno korisničko ime ili lozinka.' });
        return;
      }
      res.status(200).json({
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      });
    } catch {
      res.status(401).json({ message: 'Pogrešno korisničko ime ili lozinka.' });
    }
  }

  async getAdminUsers(_req: express.Request, res: express.Response) {
    try {
      const users = await UserModel.find().select('-passwordHash');
      res.json(users);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju korisnika.' });
    }
  }

  async getPendingAdminUsers(_req: express.Request, res: express.Response) {
    try {
      const users = await UserModel.find({ approved: false }).select('-passwordHash');
      res.json(users);
    } catch {
      res.status(500).json({ message: 'Greška pri učitavanju zahteva za registraciju.' });
    }
  }

  async approveAdminUser(req: express.Request, res: express.Response) {
    try {
      const user = await UserModel.findOneAndUpdate({ username: req.params.username }, { $set: { approved: true } }, { new: true, runValidators: true }).select('-passwordHash');
      if (!user) {
        res.status(404).json({ message: 'Korisnik nije pronađen.' });
        return;
      }
      res.json(user);
    } catch {
      res.status(500).json({ message: 'Greška pri odobravanju korisnika.' });
    }
  }

  async rejectAdminUser(req: express.Request, res: express.Response) {
    try {
      const user = await UserModel.findOne({ username: req.params.username });
      if (!user) {
        res.status(404).json({ message: 'Korisnik nije pronađen.' });
        return;
      }
      if (user.role === 'admin') {
        res.status(400).json({ message: 'Administratorski nalog nije moguće odbiti.' });
        return;
      }
      await UserModel.deleteOne({ username: req.params.username });
      res.json({ message: 'Zahtev za registraciju je odbijen.' });
    } catch {
      res.status(500).json({ message: 'Greška pri odbijanju zahteva za registraciju.' });
    }
  }


  async updateAdminUser(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username;
      for (const field of ['firstName', 'lastName', 'phone', 'email']) {
        if (req.body?.[field] != null && typeof req.body[field] !== 'string') {
          res.status(400).json({ message: 'Podaci profila nisu ispravni.' });
          return;
        }
      }
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ message: 'Podaci profila nisu ispravni.' });
        return;
      }
      if (req.body.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())) {
        res.status(400).json({ message: 'Email adresa nije ispravna.' });
        return;
      }


      const firstName = req.body.firstName;
      const lastName = req.body.lastName;
      const phone = req.body.phone;
      const email = req.body.email;

      const updates: { firstName?: string; lastName?: string; phone?: string; email?: string } = {};

      if (firstName && firstName.trim()) {
        updates.firstName = firstName.trim();
      }
      if (lastName && lastName.trim()) {
        updates.lastName = lastName.trim();
      }
      if (phone && phone.trim()) {
        updates.phone = phone.trim();
      }
      if (email && email.trim()) {

        const existingEmail = await UserModel.findOne({
          email: email.trim(),
          username: { $ne: username }
        });
        if (existingEmail) {
          res.status(400).json({ message: 'Email već postoji.' });
          return;
        }
        updates.email = email.trim();
      }
      
      const user = await UserModel.findOneAndUpdate({ username: username }, { $set: updates }, { new: true, runValidators: true }).select('-passwordHash')
      if (!user) {
        res.status(404).json({ message: 'Korisnik nije pronađen.' });
        return;
      }
      res.status(200).json(user);

    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        res.status(400).json({ message: 'Email, matični broj ili PIB već postoji.' });
        return;
      }
      if (error instanceof Error && (error.name === 'ValidationError' || error.name === 'CastError')) {
        res.status(400).json({ message: 'Podaci profila nisu ispravni. Matični broj mora imati 8 cifara, a PIB 9 cifara i ne sme počinjati nulom.' });
        return;
      }
      res.status(500).json({ message: 'Greška pri izmeni korisnika.' });
    }
  }

  async deleteAdminUser(req: express.Request, res: express.Response) {
    try {
      let username = req.params.username

      const user = await UserModel.findOne({ username: username });
      if (!user) {
        res.status(404).json({ message: 'Korisnik nije pronađen.' });
        return;
      }
      if (user.role === 'admin') {
        res.status(400).json({ message: 'Administratorski nalog nije moguće obrisati.' });
        return;
      }
      await UserModel.deleteOne({ username: username });
      res.json({ message: 'Korisnik je obrisan.' });
    } catch {
      res.status(500).json({ message: 'Greška pri brisanju korisnika.' });
    }
  }

  async getPrintingHouseCount(_req: express.Request, res: express.Response) {
    try {
      const count = await UserModel.countDocuments({ role: 'printer', approved: true, active: true });
      res.json({ count });
    } catch {
      res.status(500).json({ message: 'Greška pri prebrojavanju štamparija.' });
    }
  }

  async updateUser(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username;
      for (const field of ['firstName', 'lastName', 'phone', 'email', 'profileImage', 'institutionName', 'address', 'registrationNumber', 'pib']) {
        if (req.body?.[field] != null && typeof req.body[field] !== 'string') {
          res.status(400).json({ message: 'Podaci profila nisu ispravni.' });
          return;
        }
      }
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ message: 'Podaci profila nisu ispravni.' });
        return;
      }
      if (req.body.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())) {
        res.status(400).json({ message: 'Email adresa nije ispravna.' });
        return;
      }


      const firstName = req.body.firstName;
      const lastName = req.body.lastName;
      const phone = req.body.phone;
      const email = req.body.email;
      const profileImage = req.body.profileImage;
      const institutionName = req.body.institutionName;
      const address = req.body.address;
      const registrationNumber = req.body.registrationNumber;
      const pib = req.body.pib;

      const updates: {
        firstName?: string; lastName?: string; phone?: string; email?: string;
        profileImage?: string; institutionName?: string; address?: string;
        registrationNumber?: string; pib?: string;
      } = {};

      if (firstName && firstName.trim()) {
        updates.firstName = firstName.trim();
      }

      if (lastName && lastName.trim()) {
        updates.lastName = lastName.trim();
      }

      if (phone && phone.trim()) {
        updates.phone = phone.trim();
      }

      if (email && email.trim()) {
        const existingEmail = await UserModel.findOne({
          email: email.trim(),
          username: { $ne: username }
        });

        if (existingEmail) {
          res.status(400).json({ message: 'Email već postoji.' });
          return;
        }

        updates.email = email.trim();
      }

      if (profileImage && profileImage.trim()) {
        updates.profileImage = profileImage.trim();
      }

      if (institutionName && institutionName.trim()) {
        updates.institutionName = institutionName.trim();
      }

      if (address && address.trim()) {
        updates.address = address.trim();
      }

      if (registrationNumber && registrationNumber.trim()) {
        const existingRegNum = await UserModel.findOne({
          registrationNumber: registrationNumber.trim(),
          username: { $ne: username }
        });

        if (existingRegNum) {
          res.status(400).json({ message: 'Matični broj već postoji.' });
          return;
        }

        updates.registrationNumber = registrationNumber.trim();
      }

      if (pib && pib.trim()) {
        const existingPib = await UserModel.findOne({
          pib: pib.trim(),
          username: { $ne: username }
        });

        if (existingPib) {
          res.status(400).json({ message: 'PIB već postoji.' });
          return;
        }

        updates.pib = pib.trim();
      }

      const user = await UserModel.findOneAndUpdate(
        { username: username },
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-passwordHash');

      if (!user) {
        res.status(404).json({ message: 'Korisnik nije pronađen.' });
        return;
      }

      res.status(200).json(user);

    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        res.status(400).json({ message: 'Email, matični broj ili PIB već postoji.' });
        return;
      }
      if (error instanceof Error && (error.name === 'ValidationError' || error.name === 'CastError')) {
        res.status(400).json({ message: 'Podaci profila nisu ispravni. Matični broj mora imati 8 cifara, a PIB 9 cifara i ne sme počinjati nulom.' });
        return;
      }
      console.error(error);
      res.status(500).json({ message: 'Greška pri izmeni korisnika.' });
    }
  }

  async getUserByUsername(req: express.Request, res: express.Response) {
    try {
      const username = req.params.username;
      const user = await UserModel.findOne({ username }).select('-passwordHash');
      if (!user) {
        return res.status(404).json({ message: 'Korisnik nije pronađen.' });
      }
      return res.status(200).json(user);
    } catch {
      return res.status(500).json({ message: 'Greška pri učitavanju korisnika.' });
    }
  }

  async loginUser(req: express.Request, res: express.Response) {
    try {
      const data = req.body;
      const invalidCredentials = { message: 'Pogrešno korisničko ime ili lozinka' };
      if (!data || typeof data.username !== 'string' || !data.username.trim()
        || typeof data.password !== 'string' || !data.password) {
        return res.status(401).json(invalidCredentials);
      }

      const user = await UserModel.findOne({ username: data.username });
      if (!user) {
        return res.status(401).json(invalidCredentials);
      }
      if (!user.active) {
        return res.status(403).json({ message: 'Nalog nije aktivan.' });
      }
      if (!user.approved) {
        return res.status(403).json({ message: 'Nalog još nije odobren.' });
      }
      const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
      if (!passwordMatches) {
        return res.status(401).json(invalidCredentials);
      }

      if (user.role === 'client' && user.clientType === 'legal') {
        try {
          await finalizeClientProcurements(user.username);
        } catch (error) {
          // Završavanje nabavki ne sme sprečiti uspešnu prijavu.
          console.error('Javne nabavke nisu završene pri prijavi:', error);
        }
      }
      return res.status(200).json({
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        clientType: user.clientType ?? null
      });
    } catch {
      return res.status(500).json({ message: 'Greška pri prijavi korisnika.' });
    }
  }

  async getAllUsers(_req: express.Request, res: express.Response) {
    try {
      const users = await UserModel.find().select('-passwordHash');
      res.json(users);
    } catch {
      res.status(500).json({ error: 'Greška pri učitavanju korisnika.' });
    }
  }

  async registerUser(req: express.Request, res: express.Response) {
    // Neuspešna registracija ne sme ostaviti otpremljenu sliku na disku.
    const registrationError = async (status: number, message: string) => {
      if (req.file) {
        try {
          await unlink(req.file.path);
        } catch {
          // Brisanje nedostupnog fajla ne menja odgovor registracije.
        }
      }
      return res.status(status).json({ message });
    };

    try {
      const data = req.body;
      if (!data || typeof data.username !== 'string' || !data.username.trim()
        || typeof data.email !== 'string' || !data.email.trim()
        || typeof data.password !== 'string' || !data.password) {
        return registrationError(400, 'Unesite korisničko ime, email i lozinku.');
      }
      if (data.role !== 'client' && data.role !== 'printer') {
        return registrationError(400, 'Registracija je dozvoljena samo za klijente i štamparije.');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
        return registrationError(400, 'Email adresa nije ispravna.');
      }
      if (data.password.length < 8 || data.password.length > 12
        || !new RegExp('^(?=.*\\p{Lu})(?=.*[0-9])(?=.*[\\p{P}\\p{S}])\\p{L}.*$', 'u').test(data.password)) {
        return registrationError(400, 'Lozinka mora imati 8–12 karaktera, počinjati slovom i sadržati veliko slovo, broj i specijalni karakter.');
      }
      for (const field of ['firstName', 'lastName', 'phone']) {
        if (typeof data[field] !== 'string' || !data[field].trim()) {
          return registrationError(400, 'Ime, prezime i telefon su obavezni.');
        }
      }
      if (data.role === 'client' && data.clientType !== 'individual' && data.clientType !== 'legal') {
        return registrationError(400, 'Izaberite vrstu klijenta.');
      }
      data.username = data.username.trim();
      data.email = data.email.trim();
      const institution = data.role === 'printer' || data.clientType === 'legal';
      if (institution) {
        if (typeof data.registrationNumber !== 'string' || !/^\d{8}$/.test(data.registrationNumber)) {
          return registrationError(400, 'Matični broj mora imati tačno 8 cifara.');
        }
        if (typeof data.pib !== 'string' || !/^[1-9]\d{8}$/.test(data.pib)) {
          return registrationError(400, 'PIB mora imati 9 cifara i ne sme počinjati nulom.');
        }
      }

      const existingUser = await UserModel.findOne({ username: data.username });
      if (existingUser) {
        return registrationError(400, 'Korisničko ime već postoji.');
      }
      const existingEmail = await UserModel.findOne({ email: data.email });
      if (existingEmail) {
        return registrationError(400, 'Email adresa već postoji.');
      }
      if (institution) {
        const existingNumber = await UserModel.findOne({ registrationNumber: data.registrationNumber });
        if (existingNumber) {
          return registrationError(400, 'Matični broj već postoji.');
        }
        const existingPib = await UserModel.findOne({ pib: data.pib });
        if (existingPib) {
          return registrationError(400, 'PIB već postoji.');
        }
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      let profileImage = '/images/profiles/default_profile_image.jpg';
      if (req.file) {
        profileImage = '/uploads/profiles/' + req.file.filename;
      }
      const user = new UserModel({
        username: data.username,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        profileImage,
        role: data.role,
        clientType: data.clientType,
        institutionName: data.institutionName,
        address: data.address,
        approved: false,
        active: true
      });
      if (institution) {
        user.registrationNumber = data.registrationNumber;
        user.pib = data.pib;
      }
      await user.save();
      return res.status(201).json({ message: 'Registracija je uspešna. Nalog čeka odobrenje.' });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000 && 'keyPattern' in error) {
        const fields = error.keyPattern as { username?: number; email?: number; registrationNumber?: number; pib?: number };
        if (fields.username) return registrationError(400, 'Korisničko ime već postoji.');
        if (fields.email) return registrationError(400, 'Email adresa već postoji.');
        if (fields.registrationNumber) return registrationError(400, 'Matični broj već postoji.');
        if (fields.pib) return registrationError(400, 'PIB već postoji.');
      }
      if (error instanceof Error && error.name === 'ValidationError') return registrationError(400, 'Podaci za registraciju nisu ispravni.');
      return registrationError(500, 'Greška pri registraciji korisnika.');
    }
  }
}
