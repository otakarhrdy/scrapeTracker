import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
// Set Playwright browsers path BEFORE importing other modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(projectRoot, "pw-browsers");
import express from "express";
import cors from "cors";
import prismaModule from "@prisma/client";
const { PrismaClient } = prismaModule;
import cron from "node-cron";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { scrapeProduct } from "./scraper.js";
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
    "http://localhost:5173",
    process.env.FRONTEND_URL,
].filter(Boolean);
app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
});
// Middleware pro povolení požadavků z frontendu a zpracování JSON těla
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express.json());
// --- ZOD SCHÉMATA PRO VALIDACI VSTUPŮ ---
const AuthSchema = z.object({
    username: z.string().min(3, "Uživatelské jméno musí mít alespoň 3 znaky."),
    password: z.string().min(6, "Heslo musí mít alespoň 6 znaků."),
});
const TrackUrlSchema = z.object({
    url: z
        .string()
        .url("Zadejte platnou webovou adresu začínající na http:// nebo https://"),
});
// --- AUTH ENDPOINTY (Pseudonymní účty & Správce hesel) ---
// 1. POST: Registrace nového anonymního účtu s hashovaným heslem
app.post("/api/auth/register", async (req, res) => {
    const parseResult = AuthSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: parseResult.error.issues[0]?.message || "Neplatná data.",
        });
    }
    const { username, password } = parseResult.data;
    try {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(400).json({
                error: "Toto uživatelské jméno je již obsazené. Vygenerujte jiné.",
            });
        }
        // Bezpečné zahešování hesla (10 kol saltu)
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });
        return res.status(201).json({ id: user.id, username: user.username });
    }
    catch (err) {
        console.error("Chyba při registraci:", err);
        return res.status(500).json({ error: "Chyba serveru při vytváření účtu." });
    }
});
// 2. POST: Přihlášení k existujícímu anonymnímu účtu
app.post("/api/auth/login", async (req, res) => {
    const parseResult = AuthSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res
            .status(400)
            .json({ error: "Vyplňte uživatelské jméno i heslo." });
    }
    const { username, password } = parseResult.data;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res
                .status(401)
                .json({ error: "Neplatné uživatelské jméno nebo heslo." });
        }
        // Ověření hashe hesla
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res
                .status(401)
                .json({ error: "Neplatné uživatelské jméno nebo heslo." });
        }
        return res.json({ id: user.id, username: user.username });
    }
    catch (err) {
        console.error("Chyba při přihlašování:", err);
        return res.status(500).json({ error: "Chyba serveru při přihlašování." });
    }
});
// --- REST API ENDPOINTY PRO PRODUKTY (Vázané na uživatele) ---
// GET: Vrátí produkty POUZE přihlášeného uživatele (dle hlavičky x-user-id)
app.get("/api/products", async (req, res) => {
    const userId = Number(req.headers["x-user-id"]);
    if (!userId || isNaN(userId)) {
        return res
            .status(401)
            .json({ error: "Neautorizovaný přístup. Přihlaste se prosím." });
    }
    try {
        const products = await prisma.product.findMany({
            where: { userId },
            include: {
                priceHistory: {
                    orderBy: { timestamp: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(products);
    }
    catch (error) {
        console.error("Chyba při čtení produktů:", error);
        return res
            .status(500)
            .json({ error: "Chyba serveru při načítání produktů." });
    }
});
// POST: Přidat novou URL ke sledování pod aktuálního uživatele
app.post("/api/products", async (req, res) => {
    const userId = Number(req.headers["x-user-id"]);
    if (!userId || isNaN(userId)) {
        return res
            .status(401)
            .json({ error: "Neautorizovaný přístup. Přihlaste se prosím." });
    }
    const parseResult = TrackUrlSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ errors: parseResult.error.issues });
    }
    const { url } = parseResult.data;
    try {
        // Ověříme, zda uživatel už stejný odkaz nesleduje
        const existing = await prisma.product.findUnique({
            where: {
                url_userId: { url, userId },
            },
        });
        if (existing) {
            return res
                .status(400)
                .json({ error: "Tento produkt již ve svém účtu sledujete." });
        }
        // Provedeme scraping přes Playwright
        const scraped = await scrapeProduct(url);
        // Uložíme produkt provázaný s userId a prvním bodem v cenové historii
        const newProduct = await prisma.product.create({
            data: {
                url,
                title: scraped.title,
                currentPrice: scraped.price,
                userId,
                priceHistory: {
                    create: {
                        price: scraped.price,
                    },
                },
            },
            include: {
                priceHistory: true,
            },
        });
        return res.status(201).json(newProduct);
    }
    catch (error) {
        console.error("Chyba při scrapingu/ukládání:", error.message);
        return res
            .status(500)
            .json({ error: error.message || "Nepodařilo se načíst data z URL." });
    }
});
// DELETE: Smazat sledovaný produkt (pouze pokud patří danému uživateli)
app.delete("/api/products/:id", async (req, res) => {
    const id = Number(req.params.id);
    const userId = Number(req.headers["x-user-id"]);
    if (isNaN(id) || !userId || isNaN(userId)) {
        return res.status(400).json({ error: "Neplatný požadavek." });
    }
    try {
        await prisma.product.deleteMany({
            where: { id, userId },
        });
        return res.json({ message: "Produkt byl úspěšně odstraněn." });
    }
    catch (error) {
        console.error("Chyba při mazání:", error);
        return res.status(500).json({ error: "Chyba při mazání produktu." });
    }
});
// --- 3. AUTOMATICKÝ CRON PLÁNOVAČ ---
// Kontroluje ceny všech produktů napříč všemi uživateli každou hodinu
cron.schedule("0 * * * *", async () => {
    console.log("⏰ [CRON] Spouštím automatickou kontrolu cen všech produktů...");
    try {
        const products = await prisma.product.findMany();
        for (const product of products) {
            try {
                const scraped = await scrapeProduct(product.url);
                await prisma.priceHistory.create({
                    data: {
                        productId: product.id,
                        price: scraped.price,
                    },
                });
                await prisma.product.update({
                    where: { id: product.id },
                    data: { currentPrice: scraped.price },
                });
                console.log(`✔ [CRON] Aktualizováno: "${product.title}" -> ${scraped.price} Kč`);
            }
            catch (err) {
                console.error(`❌ [CRON] Chyba u produktu ID ${product.id}:`, err.message);
            }
        }
    }
    catch (err) {
        console.error("❌ [CRON] Chyba při spuštění plánovače:", err);
    }
});
// Servírování sestaveného React frontendu
const frontendDist = path.resolve(process.cwd(), "../frontend/dist");
if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((_req, res) => {
        res.sendFile(path.join(frontendDist, "index.html"));
    });
}
// Spuštění serveru
app.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
});
