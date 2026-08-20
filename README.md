# Price & Web Scraper Dashboard

Automatické sledování vývoje cen v čase s web scraping technologií.

## Popis projektu

Aplikace umožňuje uživatelům sledovat ceny produktů z webových stránek. Periodicky automaticky kontroluje ceny a ukládá jejich historii. Uživatelé se mohou zaregistrovat, přihlásit a spravovat seznam produktů, které chtějí sledovat.

## Klíčové funkce

- Registrace a přihlášení uživatelů s hashovaným heslem
- Přidávání URL produktů ke sledování
- Automatické scraping cen pomocí Playwright
- Sledování cenové historie v čase
- Cronovaná úloha pro pravidelné kontroly cen (každou hodinu)
- Responzivní webové rozhraní
- Nasazení na Render.com s PostgreSQL databází

## Technologický stack

### Backend

- Node.js s TypeScript
- Express.js pro HTTP API
- Prisma ORM pro databázové operace
- PostgreSQL databáze
- Playwright pro web scraping
- node-cron pro automatizaci
- bcryptjs pro bezpečnost hesel
- Zod pro validaci dat

### Frontend

- React s TypeScript
- Vite jako build tool
- Responzivní CSS design
- Axios pro API komunikaci

## Struktura projektu

```
scrapeTracker/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── index.ts        # Hlavní server a API endpointy
│   │   └── scraper.ts      # Playwright scraping funkce
│   ├── prisma/
│   │   └── schema.prisma   # Databázové schéma
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.tsx         # Hlavní komponenta
│   │   └── main.tsx        # Entry point
│   └── package.json
├── render-build.sh         # Build script pro Render.com
└── package.json            # Root package.json
```

## Instalace a spuštění lokálně

### Požadavky

- Node.js 24+
- PostgreSQL databáze

### Setup

1. Klonuj projekt

```bash
git clone https://github.com/otakarhrdy/scrapeTracker.git
cd scrapeTracker
```

2. Backend

```bash
cd backend
npm install
npx playwright install chromium
npm run build
```

3. Frontend

```bash
cd ../frontend
npm install
npm run build
```

4. Nastavení databáze

```bash
cd ../backend
# Vytvoř .env soubor s databází
# DATABASE_URL="postgresql://user:password@localhost:5432/scrapetracker"
npx prisma migrate dev
```

5. Spuštění

```bash
# V backend adresáři - Development mode
npm run dev

# V frontend adresáři - Development server
npm run dev
```

Server běží na http://localhost:5000
Frontend běží na http://localhost:5173

## API Endpointy

### Autentizace

- `POST /api/auth/register` - Registrace nového uživatele
- `POST /api/auth/login` - Přihlášení uživatele

### Produkty

- `GET /api/products` - Získání všech produktů uživatele
- `POST /api/products` - Přidání nového produktu ke sledování
- `DELETE /api/products/:id` - Smazání produktu

Všechny požadavky vyžadují hlavičku `x-user-id` s ID přihlášeného uživatele.

## Automatizace

Backend spouští cronovanou úlohu každou celou hodinu, která:

1. Načte všechny produkty všech uživatelů
2. Pro každý produkt stáhne aktuální cenu pomocí Playwright
3. Uloží cenu do databáze (pokud se liší od poslední)
4. Aktualizuje `currentPrice` v produktu

## Scrapování

Playwright je použit pro scraping HTML stránek. Implementace:

- Spuštění prohlížeče v headless režimu
- Načtení stránky s čekáním na obsah
- Extrakt dat pomocí CSS selektorů
- Parsování JSON-LD mikro-dat
- Fallback na alternativní selektory

## Nasazení na Render.com

Aplikace je nasazena na Render.com s následujícím nastavením:

### Build Command

```
bash render-build.sh
```

### Start Command

```
cd backend && npm run start
```

### Důležité: hodinová aktualizace na Renderu

`node-cron` běží pouze po dobu, kdy běží Node proces. Pokud je webová služba
na Renderu uspávaná, hodinová kontrola se nespustí. Pro spolehlivé aktualizace
vytvořte na Renderu samostatný **Cron Job** se stejným repozitářem a databází:

- **Build Command:** `bash render-build.sh`
- **Schedule:** `0 * * * *`
- **Start Command:** `cd backend && npm run refresh`

Na webové službě nastavte `ENABLE_IN_PROCESS_CRON=false`, aby se aktualizace
nespouštěla dvakrát, pokud webová instance zůstane běžet.

Dashboard si navíc data automaticky načítá každou hodinu.

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Port pro server (default: 5000)
- `FRONTEND_URL` - URL frontendu pro CORS

### Build Script (`render-build.sh`)

- Instalace Playwright binárky v project adresáři
- NPM install pro backend
- Prisma Client generace
- TypeScript kompilace
- NPM install a build pro frontend

## Bezpečnost

- Hesla jsou hashovaná pomocí bcryptjs (10 salt rounds)
- CORS kontrola pro frontend přístup
- Zod validace pro všechny API vstupy
- Každý uživatel vidí pouze své produkty

## Poznámky k vývoji

- Projekt používá ES modules (`"type": "module"` v package.json)
- TypeScript je kompilován na JavaScript v `/dist` složce
- Playwright binárky jsou instalovány do `pw-browsers/` adresáře
- `.gitignore` ignoruje `node_modules/`, `dist/`, `pw-browsers/` a env soubory

## Troubleshooting

### Playwright binárky nenalezeny

```bash
cd backend
npx playwright install chromium
```

### Databázové chyby

```bash
cd backend
npx prisma migrate dev
npx prisma db push
```

### TypeScript chyby

```bash
cd backend
npm run build
```

## Další informace

- GitHub: https://github.com/otakarhrdy/scrapeTracker
- Live aplikace: https://scrapetracker.onrender.com
