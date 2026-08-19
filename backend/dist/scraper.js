import { chromium } from "playwright";
// Pomocná funkce pro bezpečné čekání bez závislosti na verzi Playwrightu
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function scrapeProduct(url) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
        ],
    });
    try {
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport: { width: 1366, height: 768 },
            locale: "cs-CZ",
        });
        const page = await context.newPage();
        // 1. Otevřeme stránku a počkáme na DOM
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        // 2. Počkáme 2 sekundy na případné dotvoření DOMu
        await sleep(2000);
        let title = "";
        let price = 0;
        // 3. Metoda A: Zkusíme JSON-LD mikrodata
        const jsonLdElements = await page.$$('script[type="application/ld+json"]');
        for (const el of jsonLdElements) {
            try {
                const text = await el.textContent();
                if (text) {
                    const parsed = JSON.parse(text);
                    const data = Array.isArray(parsed) ? parsed[0] : parsed;
                    if (data && (data["@type"] === "Product" || data.offers)) {
                        if (data.name && !title)
                            title = data.name;
                        const offers = Array.isArray(data.offers)
                            ? data.offers[0]
                            : data.offers;
                        if (offers && offers.price) {
                            price = parseFloat(String(offers.price));
                        }
                    }
                }
            }
            catch {
                // Ignorujeme nevalidní JSON
            }
        }
        // 4. Metoda B: Titulek z <h1> nebo <title>
        if (!title) {
            const h1 = await page.$("h1");
            if (h1) {
                title = (await h1.textContent())?.trim() || "";
            }
            if (!title) {
                title = (await page.title()) || "Neznámý produkt";
            }
            title = title.split("|")[0].trim();
        }
        // 5. Metoda C: Hledání ceny v elementech
        if (!price || isNaN(price)) {
            const priceSelectors = [
                "p.price_color",
                ".price-box__price",
                ".bigPrice",
                "[data-price]",
                ".price_withVat",
                ".price-v2",
                ".c2",
                "span.price",
                ".price-item--regular",
                'meta[property="product:price:amount"]',
            ];
            let rawPrice = "";
            for (const sel of priceSelectors) {
                const el = await page.$(sel);
                if (el) {
                    const text = (await el.textContent()) ||
                        (await el.getAttribute("content")) ||
                        "";
                    if (/\d/.test(text)) {
                        rawPrice = text;
                        break;
                    }
                }
            }
            if (rawPrice) {
                const cleaned = rawPrice
                    .replace(/\s+/g, "")
                    .replace(/[^\d.,]/g, "")
                    .replace(",", ".");
                price = parseFloat(cleaned);
            }
        }
        if (!price || isNaN(price)) {
            throw new Error("Na stránce se nepodařilo nalézt platnou číselnou cenu.");
        }
        return {
            title: title || "Neznámý produkt",
            price,
        };
    }
    finally {
        await browser.close();
    }
}
