/**
 * Price the first 4 ready warehouse items — 2026-08-17
 *
 * Rail: x402 micropayments (USDC on Base) — the only payment rail live today
 * (Creem/Polar keys pending acquisition). Payee: the bootstrap seed wallet.
 * $3.00 flat per methodology asset. One-time purchase.
 *
 *   bun run price_ready.ts
 */

import {
  getWarehouseCatalog,
  updateWarehouseItem,
  generateProductId,
} from "./src/warehouse/catalog.ts";
import type { WarehouseItem } from "./src/warehouse/types.ts";

const PAY_TO = "0x57C63D275C66345819E2116c93B5ee3Bb0f497b0"; // bootstrap seed wallet (Base)
const PRICE_USD_CENTS = 300; // $3.00
const X402_UNITS = PRICE_USD_CENTS * 10_000; // USDC has 6 decimals → 3000000 = 3 USDC

const KEYWORDS: Record<string, string[]> = {
  "one main takeaway": ["content strategy", "writing focus", "editing", "ai writing"],
  "concrete specifics": ["ai slop", "copywriting", "specificity", "editing"],
  "story-first proof": ["storytelling", "content writing", "persuasion"],
  "structure generator": ["ai writing", "prompting", "outlining", "workflow"],
};

const catalog = getWarehouseCatalog();
const ready: WarehouseItem[] = catalog.items.filter((i) => i.status === "ready");

console.log(`pricing ${ready.length} ready items @ $${(PRICE_USD_CENTS / 100).toFixed(2)} (x402 · USDC · Base)`);

for (const item of ready) {
  const kw =
    Object.entries(KEYWORDS).find(([frag]) =>
      item.title.toLowerCase().includes(frag)
    )?.[1] ?? ["content doctrine", "ai writing"];

  const commerce: WarehouseItem["commerce"] = {
    ...item.commerce,
    msrpUsdCents: PRICE_USD_CENTS,
    productId: item.commerce?.productId ?? generateProductId(item.type, item.title),
    keywords: kw,
    x402: {
      enabled: true,
      price: X402_UNITS,
      asset: "USDC",
      network: "base",
      payTo: PAY_TO,
      paymentType: "one-time",
      paymentDescription: `371 Minds content doctrine: "${item.title}" — single-purchase access`,
    },
  };

  const ok = updateWarehouseItem(item.id, { commerce });
  console.log(
    ok ? `  💰 ${item.title} → $${(PRICE_USD_CENTS / 100).toFixed(2)} (SKU ${commerce.productId})` : `  ❌ failed: ${item.title}`
  );
}

console.log("\ndone — items are customer-facing. Feed → Open Mercato next.");
