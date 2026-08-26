import test from "node:test";
import assert from "node:assert/strict";

import { extractDataFromHtml, extractPriceValue } from "../src/scraper.ts";

test("extractPriceValue parses Czech decimal formats correctly", () => {
  assert.equal(extractPriceValue("1.299,00"), 1299);
  assert.equal(extractPriceValue("1 299,-"), 1299);
  assert.equal(extractPriceValue("1299 Kč"), 1299);
});

test("extractDataFromHtml supports @graph JSON-LD and Czech price formats", () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@graph": [{
            "@type": "Product",
            "name": "Test Produkt",
            "offers": { "price": "1.299,00", "priceCurrency": "CZK" }
          }]
        }
        </script>
      </head>
      <body>Test Produkt</body>
    </html>
  `;

  const result = extractDataFromHtml(html);
  assert.ok(result);
  assert.equal(result!.title, "Test Produkt");
  assert.equal(result!.price, 1299);
});
