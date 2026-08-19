import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import { z } from "zod";
import { scrapeProduct } from "./scraper.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware pro povolení požadavků z Reactu a parsování JSON
app.use(cors());
app.use(express.json());

// --- 1. Zod validace příchozí URL ---
const TrackUrlSchema = z.object({
  url: z
    .string()
    .url("Zadejte platnou webovou adresu začínající na http:// nebo https://"),
});

// --- 2. REST API Endpointy ---

// GET: Vrátí všechny sledované produkty včetně celé jejich cenové historie
app.get("/api/products", async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        priceHistory: {
          orderBy: { timestamp: "asc" }, // Historie seřazená chronologicky pro graf
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(products);
  } catch (error) {
    console.error("Chyba při čtení produktů:", error);
    return res
      .status(500)
      .json({ error: "Chyba serveru při načítání produktů" });
  }
});

// POST: Přidat novou URL ke sledování (okamžitě stáhne první data)
app.post("/api/products", async (req: Request, res: Response) => {
  const parseResult = TrackUrlSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.issues });
  }

  const { url } = parseResult.data;

  try {
    // 1. Zkontrolujeme, zda už URL v databázi nesledujeme
    const existing = await prisma.product.findUnique({ where: { url } });
    if (existing) {
      return res.status(400).json({ error: "Tento produkt již sledujete" });
    }

    // 2. Provedeme první scraping stránky
    const scraped = await scrapeProduct(url);

    // 3. Vytvoříme produkt a rovnou vložíme první bod do historie cen
    const newProduct = await prisma.product.create({
      data: {
        url,
        title: scraped.title,
        currentPrice: scraped.price,
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
  } catch (error: any) {
    console.error("Chyba při scrapingu/ukládání:", error.message);
    return res
      .status(500)
      .json({ error: error.message || "Nepodařilo se načíst data z URL" });
  }
});

// DELETE: Smazat produkt ze sledování
app.delete("/api/products/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Neplatné ID" });

  try {
    // Díky "onDelete: Cascade" v Prisma schématu se smaže i cenová historie
    await prisma.product.delete({ where: { id } });
    return res.json({ message: "Produkt byl úspěšně odstraněn" });
  } catch (error) {
    return res.status(500).json({ error: "Chyba při mazání produktu" });
  }
});

// --- 3. Automatický CRON plánovač (Sledování na pozadí) ---
// Běží automaticky každou hodinu (syntaxe: minuta hodina den měsíc den-v-týdnu)
// Pro testování každých 5 minut lze změnit na: '*/5 * * * *'
cron.schedule("0 * * * *", async () => {
  console.log("⏰ [CRON] Spouštím automatickou kontrolu cen všech produktů...");

  try {
    const products = await prisma.product.findMany();

    for (const product of products) {
      try {
        const scraped = await scrapeProduct(product.url);

        // Uložíme nový časový bod s cenou
        await prisma.priceHistory.create({
          data: {
            productId: product.id,
            price: scraped.price,
          },
        });

        // Aktualizujeme aktuální cenu u produktu
        await prisma.product.update({
          where: { id: product.id },
          data: { currentPrice: scraped.price },
        });

        console.log(
          `✔ [CRON] Aktualizováno: "${product.title}" -> ${scraped.price} Kč`,
        );
      } catch (err: any) {
        console.error(
          `❌ [CRON] Chyba u produktu ID ${product.id}:`,
          err.message,
        );
      }
    }
  } catch (err) {
    console.error("❌ [CRON] Chyba při spuštění plánovače:", err);
  }
});

// Spuštění serveru
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
