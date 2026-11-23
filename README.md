# Price & Web Scraper Dashboard

Automatické sledování vývoje cen v čase s web scraping technologií.

## Popis projektu

Aplikace umožňuje uživatelům sledovat ceny produktů z webových stránek. Periodicky automaticky kontroluje ceny a ukládá jejich historii. Uživatelé se mohou zaregistrovat, přihlásit a spravovat seznam produktů, které chtějí sledovat.

## Klíčové funkce

- Registrace a přihlášení uživatelů s hashovaným heslem
- Přidávání URL produktů ke sledování
- Automatické scraping cen pomocí Playwright
- Sledování cenové historie v čase
- Cronovaná úloha pro pravidelné denní kontroly cen
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

Backend automaticky spouští kontrolu cen každý den ve 11:00 podle časového
pásma Europe/Prague. Nasazení na Renderu používá:

- placenou instanci webové služby, která se automaticky nespíná,
- GitHub Actions jako externí spouštěč ve 11:00,
- interní `node-cron` jako pojistku, pokud platí webová instance.

Proces:

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
- Při běžné síťové chybě nebo stránce vykreslované JavaScriptem se použije
  Playwright
- Pokud web vrátí CAPTCHA, ochrannou stránku nebo HTTP 401/403/429, scraper
  přístup neobchází a vrátí srozumitelnou chybu. U takových webů použijte
  oficiální API nebo jiný webem povolený způsob přístupu.

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

### Důležité: denní aktualizace na Renderu

Webová služba je ve souboru `render.yaml` nasazena na placeném Renderu
(`plan: starter`), aby se při nečinnosti nespínala.

GitHub Actions workflow `.github/workflows/daily-price-refresh.yml` volá
`/api/cron/refresh` každý den ve 11:00 podle času Prahy. Nastavte v GitHubu
secret `APP_URL` s veřejnou URL aplikace.
Volitelně nastavte stejný secret `CRON_SECRET` jak v GitHubu, tak na Renderu;
workflow pak endpoint zavolá s hlavičkou `x-cron-secret`.

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

- Hesla jsou hashovaná
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
