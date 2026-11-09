# Potvrda korpe i fakture

Pokrenite MongoDB, backend (`npm start`) i Angular frontend.
Za kreiranje i čuvanje faktura nije potrebna email konfiguracija.
Fakture se ne šalju emailom. Brevo obaveštenja o javnim nabavkama su zasebna funkcionalnost.

## Endpointi

- `POST /orders/confirm` prima `{ clientUsername, items }`, ali stavke uzima iz sačuvane korpe u bazi.
- `GET /orders/client/:username` vraća porudžbine klijenta.
- `PUT /orders/:invoiceId/cancel` otkazuje samo status `naručeno` i vraća zalihe odgovarajućoj štampariji.
- Postojeći `POST /orders/create` koristi istu potvrdu sačuvane korpe; ne dozvoljava zaobilaženje provera.

Backend privremeno zaključava korpu pomoću `checkingOut`, proverava sve stavke pre upisa,
sabira količine za istu šifru i štampariju i
uzima vlasnika, naziv, cenu i cenu odabrane usluge iz baze. Jedan dokument u
`orders` nastaje za svaku štampariju. `invoiceId` generiše backend pomoću UUID-a.
Početni status je `naručeno`; tok nema plaćanje.

Umanjenje zaliha koristi atomski uslov `stock >= quantity`. Ako upis porudžbine
ili umanjenje zaliha ne uspe, potvrda briše svoje porudžbine i vraća zalihe koje
je već umanjila. Ovo nije višedokumentna transakcija: pri prekidu procesa ili baze
usred potvrde proverite porudžbine pre ponavljanja zahteva.

## PDF fakture

`src/utils/invoice.ts` pravi i čuva po jedan PDF u `backend/generated/invoices/`.
Ime fajla odgovara ID-u fakture. Liberation Sans fontovi podržavaju srpska slova;
licenca je u `assets/fonts/LICENSE_LIBERATION`.
Cena po stavci uključuje količinu, osnovnu cenu i dodatnu cenu štampe.

Uspešno čuvanje vraća HTTP 201 sa poljima `message`, `orders` i `warning`.
Ako generisanje PDF-a zakaže, porudžbine ostaju sačuvane, a odgovor sadrži upozorenje.
Backend prazni korpu nakon čuvanja porudžbina; frontend ažurira prikaz.
Ponovljena potvrda prazne ili trenutno zaključane korpe vraća HTTP 409.
U slučaju pada procesa proverite porudžbine i zalihe pre ručnog oslobađanja `checkingOut`;
zaključavanje se ne uklanja automatski jer potvrda možda već ima sačuvane porudžbine.

## Kratak ručni test

1. Prijavite se kao fizičko lice i dodajte proizvode iz dve štamparije.
2. Potvrdite korpu jednom.
3. Proverite dve porudžbine na profilu, umanjene zalihe i praznu korpu.
4. Proverite PDF fajlove u `backend/generated/invoices/`.

`npm test` pokreće brze regresione testove bez baze.
`npm run test:integration` pokreće integracione testove u novoj privremenoj MongoDB bazi,
čuva test fajlove u sistemskom privremenom direktorijumu i simulira email slanje.
Test baza se briše po završetku; postojeća `printing_house` baza se ne menja.
