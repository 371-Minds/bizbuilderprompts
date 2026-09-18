#!/usr/bin/env bun
/**
 * Flip one sellable warehouse item to x402 base-sepolia (testnet) for the
 * meta-purchase smoke: official x402 client → facilitator verify → settle.
 * Idempotent: marks the chosen item and leaves everything else untouched.
 */
import { buildManifest } from "../src/manifest.ts";
import { buildWarehouseCatalog, updateWarehouseItem } from "../src/warehouse/catalog.ts";

const manifest = await buildManifest();
const catalog = buildWarehouseCatalog(manifest);
const item = catalog.items.find((i: any) => i.status === "ready" && i.commerce?.x402?.enabled);
if (!item) {
  console.error("no sellable item found");
  process.exit(1);
}

const commerce = {
  ...item.commerce,
  x402: {
    ...item.commerce.x402,
    network: "base-sepolia",
    paymentDescription: `[TESTNET SMOKE] ${item.commerce.x402.paymentDescription ?? item.title}`,
  },
};

const ok = updateWarehouseItem(item.id, { commerce });
console.log(ok
  ? `✅ ${item.id} → base-sepolia (${item.commerce.x402.price} base units, payTo ${item.commerce.x402.payTo})`
  : `❌ update failed for ${item.id}`);
