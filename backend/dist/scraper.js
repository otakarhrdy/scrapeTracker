import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
// Sdílená instance prohlížeče (zabrání pomalému spouštění od nuly)
let globalBrowser = null;
async function getBrowser() {
    if (!globalBrowser || !globalBrowser.isConnected()) {
        globalBrowser = await chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        });
    }
    return globalBrowser;
}
function findProductInJsonLd(data) {
    if (!data || typeof data !== "object")
        return null;
    if (Array.isArray(data)) {
        for (const item of data) {
            const found = findProductInJsonLd(item);
            if (found)
                return found;
        }
        return null;
    }
    const value = data;
    if (value["@type"] === "Product" || value["@type"] === "Offer") {
        return value;
    }
    if (value["@graph"]) {
        const graphProduct = findProductInJsonLd(value["@graph"]);
        if (graphProduct)
            return graphProduct;
    }
    return null;
}
export function extractPriceValue(raw) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    if (typeof raw !== "string")
        return null;
    let cleaned = raw
        .replace(/\s+/g, "")
        .replace(/[\u00a0]/g, "")
        .replace(/[^\d,\.]/g, "");
    if (!cleaned)
        return null;
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");
    if (hasComma && hasDot) {
        const lastComma = cleaned.lastIndexOf(",");
        const lastDot = cleaned.lastIndexOf(".");
        const decimalSeparator = lastComma > lastDot ? "," : ".";
        const thousandsSeparator = decimalSeparator === "," ? "." : ",";
        cleaned = cleaned.replace(new RegExp(`\\${thousandsSeparator}`, "g"), "");
        cleaned = cleaned.replace(decimalSeparator, ".");
    }
    else if (hasComma) {
        const parts = cleaned.split(",");
        if (parts.length > 2) {
            cleaned = parts.join("");
        }
        else if (parts[1] && parts[1].length <= 2) {
            cleaned = cleaned.replace(",", ".");
        }
        else {
            cleaned = cleaned.replace(",", "");
        }
    }
    else if (hasDot) {
        const parts = cleaned.split(".");
        if (parts.length > 2) {
            const lastPart = parts[parts.length - 1];
            if (lastPart.length === 2 || lastPart.length === 3) {
                cleaned = parts.slice(0, -1).join("") + "." + lastPart;
            }
            else {
                cleaned = cleaned.replace(/\./g, "");
            }
        }
    }
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    return parsed;
}
// Pomocná funkce pro vytažení dat z HTML (JSON-LD + meta značky)
export function extractDataFromHtml(html) {
    const $ = cheerio.load(html);
    // A) Rychlé vyhledání v JSON-LD mikrodatech
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
            const content = $(jsonLdScripts[i]).html();
            if (!content)
                continue;
            const data = JSON.parse(content);
            const product = findProductInJsonLd(data);
            if (product) {
                const title = product.name || product["name"] || $("title").text().trim();
                const offer = product.offers || product["offers"] || product;
                const priceValue = offer?.price ||
                    offer?.lowPrice ||
                    offer?.highPrice ||
                    offer?.offers?.price ||
                    (Array.isArray(offer) ? offer[0]?.price : null) ||
                    (Array.isArray(offer?.offers) ? offer.offers[0]?.price : null);
                if (title && priceValue) {
                    const parsedPrice = extractPriceValue(priceValue);
                    if (parsedPrice !== null) {
                        return { title: String(title).trim(), price: parsedPrice };
                    }
                }
            }
        }
        catch {
            // Ignorujeme nevalidní JSON bloky
        }
    }
    // B) Fallback na meta tagy
    const metaTitle = $('meta[property="og:title"]').attr("content") || $("title").text().trim();
    const metaPrice = $('meta[property="product:price:amount"]').attr("content") ||
        $('meta[property="og:price:amount"]').attr("content");
    if (metaTitle && metaPrice) {
        const parsedPrice = extractPriceValue(metaPrice);
        if (parsedPrice !== null) {
            return { title: metaTitle, price: parsedPrice };
        }
    }
    return null;
}
// Hlavní scraper funkce
export async function scrapeProduct(url) {
    // 1. Ultra-rychlý pokus přes Axios (~200 až 500 ms)
    try {
        const response = await axios.get(url, {
            timeout: 3500,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
            },
        });
        const directResult = extractDataFromHtml(response.data);
        if (directResult) {
            return directResult;
        }
    }
    catch {
        // Pokud Axios selže (např. Cloudflare ochrana), pokračujeme na Playwright
    }
    // 2. Playwright fallback s blokováním zbytečných médií
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    // Zablokování stahování obrázků, stylů a fontů pro maximální rychlost
    await page.route("**/*", (route) => {
        const resourceType = route.request().resourceType();
        if (["image", "stylesheet", "font", "media", "imageset"].includes(resourceType)) {
            route.abort();
        }
        else {
            route.continue();
        }
    });
    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const html = await page.content();
        const playwrightResult = extractDataFromHtml(html);
        if (playwrightResult) {
            return playwrightResult;
        }
        const title = (await page.title()) || "Neznámý produkt";
        const bodyText = await page.innerText("body");
        const priceMatch = bodyText.match(/(\d[\d\s]*([.,]\d{1,2})?)\s*(Kč|CZK|€|\$)/i);
        if (priceMatch) {
            const cleanPrice = parseFloat(priceMatch[1].replace(/\s+/g, "").replace(",", "."));
            if (!isNaN(cleanPrice) && cleanPrice > 0) {
                return { title: title.replace(/\s+/g, " ").trim(), price: cleanPrice };
            }
        }
        throw new Error("Nepodařilo se najít cenu produktu");
    }
    finally {
        await page.close();
        await context.close();
    }
}
