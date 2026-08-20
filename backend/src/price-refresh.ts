import prismaModule from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";

const { PrismaClient } = prismaModule;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(projectRoot, "pw-browsers");

const { scrapeProduct } = await import("./scraper.js");
type DatabaseClient = InstanceType<typeof PrismaClient>;

export async function refreshPrices(prisma: DatabaseClient): Promise<void> {
  const products = await prisma.product.findMany();
  console.log(`[PRICE REFRESH] Nalezeno produktu: ${products.length}`);

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

      console.log(
        `[PRICE REFRESH] Aktualizovano: "${product.title}" -> ${scraped.price} Kc`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[PRICE REFRESH] Chyba u produktu ID ${product.id}:`,
        message,
      );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prisma = new PrismaClient();

  try {
    console.log("[PRICE REFRESH] Spoustim kontrolu cen...");
    await refreshPrices(prisma);
    console.log("[PRICE REFRESH] Kontrola cen dokoncena.");
  } catch (error) {
    console.error("[PRICE REFRESH] Kontrola selhala:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
