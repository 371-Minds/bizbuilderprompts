/**
 * x402 purchase flow — the warehouse's path to first revenue.
 *
 * GET /warehouse/buy/:id  → 402 + X-PAYMENT-REQUIRED for ready, x402-priced items
 * POST /warehouse/buy/:id → facilitator-verified settlement → full asset delivery
 *
 * Protocol reference: https://x402.org (facilitator /verify flow, docs.x402.org)
 */

import { appendFileSync } from "fs";
import { getWarehouseItemById, getWarehouseItemContent } from "../warehouse/catalog.js";
import type { WarehouseItem } from "../warehouse/types.js";
import {
  buildX402PaymentRequiredHeader,
  decodeX402Header,
  buildStorefrontCard,
  formatX402Price,
} from "./config.js";
import type { X402PaymentRequiredPayload } from "./types.js";

// ── Facilitator fetch guard ───────────────────────────────────────────────────

/**
 * Facilitator base URLs allowlisted at boot. The verify fetch can only ever
 * target one of these hosts over http/https — never a user-supplied URL.
 * The CDP v1 facilitator is the default because the x402.org public
 * facilitator is testnet-only and our items are priced on Base mainnet.
 */
export const FACILITATOR_ALLOWLIST = [
  "https://api.cdp.coinbase.com/platform/v1/x402",
  "https://x402.org",
] as const;

const DEFAULT_FACILITATOR = FACILITATOR_ALLOWLIST[0];

export function resolveFacilitatorBase(candidate: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const canonical = FACILITATOR_ALLOWLIST.find((a) => {
    const allowed = new URL(a);
    return allowed.origin === parsed.origin;
  });
  return canonical ?? null;
}

/** Resolved once at boot from the env override (must be allowlisted). */
export const FACILITATOR_BASE: string =
  resolveFacilitatorBase(process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR) ??
  DEFAULT_FACILITATOR;

export const VERIFY_URL = `${FACILITATOR_BASE}/verify`;

// ── Offer resolution (GET → 402) ─────────────────────────────────────────────

export type PurchaseOffer =
  | { kind: "not-found" }
  | { kind: "conflict"; reason: string; status: string }
  | {
      kind: "offer";
      header: string;
      payload: X402PaymentRequiredPayload;
      storefrontCard: Record<string, unknown>;
      instructions: {
        priceDisplay: string;
        asset: string;
        network: string;
        paymentType: string;
        payTo: string;
        memo: string;
        howToPay: string;
      };
    };

export function resolvePurchaseOffer(id: string): PurchaseOffer {
  const item = getWarehouseItemById(id);
  if (!item) return { kind: "not-found" };

  const x402 = item.commerce?.x402;
  if (!x402 || !x402.enabled) {
    return { kind: "conflict", reason: "item is not for sale via x402", status: item.status };
  }
  if (typeof x402.price !== "number" || x402.price <= 0) {
    return { kind: "conflict", reason: "item has no valid x402 price", status: item.status };
  }
  if (item.status !== "ready" && item.status !== "featured") {
    return { kind: "conflict", reason: `item is not ready for sale (status: ${item.status})`, status: item.status };
  }

  const header = buildX402PaymentRequiredHeader(x402);
  const payload = decodeX402Header(header);
  if (!payload) {
    return { kind: "conflict", reason: "failed to build payment requirements", status: item.status };
  }

  const priceDisplay = formatX402Price(x402.price, x402.asset);
  return {
    kind: "offer",
    header,
    payload,
    storefrontCard: buildStorefrontCard(item),
    instructions: {
      priceDisplay,
      asset: x402.asset,
      network: x402.network,
      paymentType: x402.paymentType,
      payTo: x402.payTo,
      memo: x402.paymentDescription || item.title,
      howToPay:
        `Pay ${priceDisplay} to unlock this asset. Send an x402 exact-scheme payment per the ` +
        `X-PAYMENT-REQUIRED header, then retry this endpoint with POST and the base64 payment ` +
        `payload in the X-PAYMENT header.`,
    },
  };
}

// ── Settlement (POST → verify → fulfill) ─────────────────────────────────────

export interface SaleRecord {
  ts: string;
  itemId: string;
  title: string;
  amount: number;
  asset: string;
  txHash: string | null;
  network: string;
}

export interface SettlementResult {
  kind: "fulfilled" | "not-found" | "conflict" | "payment-required" | "invalid-payment" | "facilitator-error";
  reason?: string;
  item?: WarehouseItem;
  content?: string;
  sale?: SaleRecord;
}

export interface SettlementDeps {
  fetchImpl?: typeof fetch;
  verifyUrl?: string;
  ledgerPath?: string;
  eventsUrl?: string;
  now?: () => Date;
}

interface VerifyResponse {
  isValid?: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
  transaction?: string;
  txHash?: string;
}

async function verifyWithFacilitator(
  xPaymentHeader: string,
  requirements: X402PaymentRequiredPayload,
  deps: SettlementDeps,
): Promise<{ ok: true; body: VerifyResponse } | { ok: false; error: string }> {
  const doFetch = deps.fetchImpl ?? fetch;
  const verifyUrl = deps.verifyUrl ?? VERIFY_URL;
  try {
    const res = await doFetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: xPaymentHeader,
        paymentRequirements: requirements,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as VerifyResponse;
    if (!res.ok) {
      return { ok: false, error: body.invalidMessage || `facilitator returned HTTP ${res.status}` };
    }
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: `facilitator unreachable: ${(err as Error).message}` };
  }
}

export async function settlePurchase(
  id: string,
  xPaymentHeader: string | null,
  deps: SettlementDeps = {},
): Promise<SettlementResult> {
  const offer = resolvePurchaseOffer(id);
  if (offer.kind === "not-found") return { kind: "not-found" };
  if (offer.kind === "conflict") return { kind: "conflict", reason: offer.reason };
  const item = getWarehouseItemById(id)!;
  const x402 = item.commerce!.x402!;

  if (!xPaymentHeader) {
    return { kind: "payment-required", reason: "missing X-PAYMENT header" };
  }
  if (!decodeX402Header(xPaymentHeader)) {
    return { kind: "invalid-payment", reason: "X-PAYMENT header is not a valid base64 JSON payload" };
  }

  const verification = await verifyWithFacilitator(xPaymentHeader, offer.payload, deps);
  if (!verification.ok) {
    return { kind: "facilitator-error", reason: verification.error };
  }
  if (!verification.body.isValid) {
    return {
      kind: "invalid-payment",
      reason: verification.body.invalidMessage || verification.body.invalidReason || "payment rejected by facilitator",
    };
  }

  const sale: SaleRecord = {
    ts: (deps.now ?? (() => new Date()))().toISOString(),
    itemId: item.id,
    title: item.title,
    amount: x402.price,
    asset: x402.asset,
    txHash: verification.body.txHash ?? verification.body.transaction ?? null,
    network: x402.network,
  };
  try {
    appendFileSync(deps.ledgerPath ?? "warehouse/sales.jsonl", JSON.stringify(sale) + "\n");
  } catch (err) {
    return { kind: "facilitator-error", reason: `failed to record sale: ${(err as Error).message}` };
  }

  const doFetch = deps.fetchImpl ?? fetch;
  void doFetch(deps.eventsUrl ?? "http://127.0.0.1:3710/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "warehouse.sale",
      source: "bizbuilderprompts",
      itemId: sale.itemId,
      title: sale.title,
      amount: sale.amount,
      asset: sale.asset,
      txHash: sale.txHash,
      network: sale.network,
      ts: sale.ts,
    }),
  }).catch(() => {});

  return { kind: "fulfilled", item, content: getWarehouseItemContent(item), sale };
}
