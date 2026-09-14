import express from 'express'
import UserModel from '../models/user';
import bcrypt from 'bcrypt';

export class UserController {

  loginUser = (req: express.Request, res: express.Response) => {
    const data = req.body;
    const invalidCredentials = { message: 'Pogrešno korisničko ime ili lozinka' };

    if (!data || typeof data.username !== 'string' || !data.username.trim()
      || typeof data.password !== 'string' || !data.password) {
      return res.status(401).json(invalidCredentials);
    }

    return UserModel.findOne({ username: data.username }).then((user) => {
      if (!user) {
        return res.status(401).json(invalidCredentials);
      }
      if (!user.active) {
        return res.status(403).json({ message: 'Nalog nije aktivan.' });
      }
      if (!user.approved) {
        return res.status(403).json({ message: 'Nalog još nije odobren.' });
      }

      return bcrypt.compare(data.password, user.passwordHash).then((passwordMatches) => {
        if (!passwordMatches) {
          return res.status(401).json(invalidCredentials);
        }

        return res.status(200).json({
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          clientType: user.clientType ?? null
        });
      });
    }).catch(() => {
      return res.status(500).json({ message: 'Greška pri prijavi korisnika.' });
    });
  }

  getAllUsers = (req: express.Request, res: express.Response) => {
    UserModel.find().then((users) => {
      res.json(users);
    }).catch(() => {
      res.status(500).json({ error: 'Greška pri učitavanju korisnika.' });
    });
  }

  registerUser = (req: express.Request, res: express.Response) => {
    const data = req.body;

    if (!data || typeof data.username !== 'string' || !data.username.trim()
      || typeof data.email !== 'string' || !data.email.trim()
      || typeof data.password !== 'string' || !data.password) {
      return res.status(400).json({ message: 'Unesite korisničko ime, email i lozinku.' });
    }

    if (data.role !== 'client' && data.role !== 'printer') {
      return res.status(400).json({ message: 'Registracija je dozvoljena samo za klijente i štamparije.' });
    }

    return UserModel.findOne({ username: data.username }).then((existingUser) => {
      if (existingUser) {
        return res.status(400).json({ message: 'Korisničko ime već postoji.' });
      }

      return UserModel.findOne({ email: data.email }).then((existingEmail) => {
        if (existingEmail) {
          return res.status(400).json({ message: 'Email adresa već postoji.' });
        }

        return bcrypt.hash(data.password, 10).then((passwordHash) => {
          const user = new UserModel({
            username: data.username,
            passwordHash: passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            email: data.email,
            profileImage: data.profileImage || 'default_profile_image.jpg',
            role: data.role,
            clientType: data.clientType,
            institutionName: data.institutionName,
            address: data.address,
            registrationNumber: data.registrationNumber,
            pib: data.pib,
            approved: false,
            active: true
          });

          return user.save().then(() => {
            return res.status(201).json({ message: 'Registracija je uspešna. Nalog čeka odobrenje.' });
          });
        });
      });
    }).catch((error) => {
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Proverite obavezne podatke za registraciju.' });
      }
      return res.status(500).json({ message: 'Greška pri registraciji korisnika.' });
    });
  }


}
