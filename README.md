# Printing House

Studentska web aplikacija za klijente, štamparije i administratora.
Frontend koristi Angular, a backend Express i Mongoose sa lokalnom MongoDB bazom.

## Preduslovi

- Node.js 22.12+ iz grane 22 ili Node.js 24+ i npm.
- Lokalno pokrenut MongoDB na portu 27017.
- Brevo nalog sa verifikovanim pošiljaocem za email obaveštenja i reset lozinke.

## Instalacija

Iz korenskog foldera projekta pokrenuti:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
```

Korenski `npm ci` je potreban jer je paket `image-size`, koji koristi backend,
trenutno deklarisan u korenskom `package.json`.
U `backend/.env` uneti svoje Brevo vrednosti. Prave ključeve ne dodavati u Git.
Bez tih vrednosti slanje emailova neće raditi.

## Pokretanje

U jednom terminalu, iz korena projekta:

```bash
npm start --prefix backend
```

U drugom terminalu:

```bash
npm start --prefix frontend
```

- Frontend: http://localhost:4200
- Backend: http://localhost:4000
- Baza: `mongodb://127.0.0.1:27017/printing_house`

Portovi i lokalni URL-ovi podešeni su u postojećem kodu.
Repozitorijum ne sadrži MongoDB podatke niti automatsko kreiranje početnog
administratora. Za rad sa postojećim nalozima i katalogom potrebna je zasebna
lokalna baza. Nemojte dodavati dump sa stvarnim korisničkim podacima u Git.

## Provere

```bash
npm run build --prefix backend
npm run build --prefix frontend
npm test --prefix backend
npm test --prefix frontend -- --watch=false --browsers=ChromeHeadless
```

Frontend testovi zahtevaju instaliran Chrome/Chromium. Ako nije na standardnoj
putanji, postaviti `CHROME_BIN` na izvršni fajl odgovarajućeg pregledača.

Backend integracioni testovi zahtevaju pokrenut lokalni MongoDB:

```bash
npm run test:integration --prefix backend
```

Oni koriste privremenu bazu sa prefiksom `printing_house_audit_`, koju na kraju
brišu. Slanje emailova u tim testovima je zamenjeno simulacijom.

## Struktura

- `frontend/src/app`: stranice, zajedničke komponente, servisi i guardovi.
- `frontend/public/products`: demo slike proizvoda.
- `backend/src`: Express rute, kontroleri, Mongoose modeli i pomoćne funkcije.
- `backend/assets/fonts`: fontovi za PDF, zajedno sa njihovom licencom.
- `backend/tests`: backend testovi.
- `USED_LIBRARIES.txt`: pregled biblioteka i njihove namene.
- `backend/ORDERS.md`: napomene o porudžbinama.

## Fajlovi koji se ne šalju na Git

`.gitignore` isključuje `node_modules`, build rezultate, `.env`, logove,
generisane PDF fakture i uploadovane korisničke slike. Primer konfiguracije
`backend/.env.example`, demo slike i podrazumevane profilne slike ostaju u Gitu.

Uploadovane slike u lokalnoj bazi mogu imati putanje do fajlova koji nisu
u repozitorijumu. Njih treba preneti zasebno ako se prenosi postojeća baza.

Ovo je studentska aplikacija za lokalni rad. Postojeće prijavljivanje preko
`currentUser` u localStorage i frontend guardova nije potpuna serverska
autorizacija za javno produkciono okruženje.
