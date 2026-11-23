import test from "node:test";
import assert from "node:assert/strict";

import {
  extractDataFromHtml,
  extractPriceValue,
  getAccessBlockReason,
} from "../src/scraper.ts";

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

test("getAccessBlockReason reports denied and rate-limited responses", () => {
  assert.match(getAccessBlockReason(403, "") ?? "", /HTTP 403/);
  assert.match(getAccessBlockReason(429, "") ?? "", /HTTP 429/);
  assert.equal(getAccessBlockReason(200, "<html><body>Produkt</body></html>"), null);
});

test("getAccessBlockReason identifies CAPTCHA pages without extracting prices", () => {
  const reason = getAccessBlockReason(
    200,
    "<html><body>Please verify that you are human. Product 1 299 Kč</body></html>",
  );

  assert.match(reason ?? "", /ochranu proti automatizovanému přístupu/);
});
