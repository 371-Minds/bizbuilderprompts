/**
 * Price the newly-approved 50Ways items — 2026-08-22
 *
 * Mirrors price_ready.ts: $3.00 flat, x402 (USDC on Base), bootstrap seed
 * wallet. Scoped to the items promoted by revisit_50ways.ts this run.
 *
 *   bun run price_newly_ready.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  getWarehouseCatalog,
  updateWarehouseItem,
  generateProductId,
} from "./src/warehouse/catalog.ts";
import type { WarehouseItem } from "./src/warehouse/types.ts";

const PAY_TO = "0x57C63D275C66345819E2116c93B5ee3Bb0f497b0"; // bootstrap seed wallet (Base)
const PRICE_USD_CENTS = 300; // $3.00
const X402_UNITS = PRICE_USD_CENTS * 10_000; // USDC 6 decimals → 3 USDC

const KEYWORDS: Record<string, string[]> = {
  "one reader problem": ["content strategy", "writing focus", "editing", "ai writing"],
  "audience definition": ["audience", "positioning", "content strategy"],
  "promise-driven opening": ["copywriting", "opening", "conversion", "persuasion"],
  outline: ["ai writing", "prompting", "outlining", "workflow"],
  "fluff cut": ["editing", "concision", "ai slop", "copywriting"],
  "specifics-forcing": ["ai slop", "copywriting", "specificity", "prompting"],
  "audience context": ["ai prompts", "audience", "context", "prompting"],
  "confusion test": ["testing", "feedback", "clarity", "iteration"],
};

const { outcomes } = JSON.parse(
  readFileSync(join(import.meta.dir, "revisit_outcomes.json"), "utf8")
) as { outcomes: Array<{ id: string; verdict: string }> };
const promoted = new Set(outcomes.filter((o) => o.verdict === "APPROVE").map((o) => o.id));

const catalog = getWarehouseCatalog();
const toPrice: WarehouseItem[] = catalog.items.filter(
  (i) => i.status === "ready" && promoted.has(i.id) && !i.commerce?.msrpUsdCents
);

console.log(`pricing ${toPrice.length} newly-approved items @ $${(PRICE_USD_CENTS / 100).toFixed(2)} (x402 · USDC · Base)`);

for (const item of toPrice) {
  const kw =
    Object.entries(KEYWORDS).find(([frag]) => item.title.toLowerCase().includes(frag))?.[1] ??
    ["content doctrine", "ai writing"];

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
    ok ? `  💰 ${item.title} → $3.00 (SKU ${commerce.productId})` : `  ❌ failed: ${item.title}`
  );
}
