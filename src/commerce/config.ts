import type {
  CommerceConfig,
  X402Config,
  X402PaymentRequiredPayload,
  X402Network,
} from "./types.js";
import { X402_NETWORK_IDS, USDC_ADDRESSES } from "./types.js";

/**
 * Build the x402 `X-PAYMENT-REQUIRED` header payload for a given item.
 * Returns a base64-encoded JSON string ready to set as the header value.
 *
 * Usage in an HTTP response:
 *   res.status(402).setHeader("X-PAYMENT-REQUIRED", buildX402Header(config));
 */
export function buildX402PaymentRequiredHeader(config: X402Config): string {
  const networkId = X402_NETWORK_IDS[config.network] ?? config.network;

  // Resolve token asset address — if the caller passed a symbol like "USDC",
  // look up the well-known contract address; otherwise use it as-is (custom token).
  let assetAddress = config.asset;
  if (config.asset.toUpperCase() === "USDC") {
    assetAddress =
      USDC_ADDRESSES[config.network as X402Network] ??
      "0x0000000000000000000000000000000000000000";
  } else if (!config.asset.startsWith("0x") && config.asset !== "ETH") {
    // Treat it as a symbol we don't know — use native token zero address
    assetAddress = "0x0000000000000000000000000000000000000000";
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-minute window

  const payload: X402PaymentRequiredPayload = {
    version: "1.0",
    accepts: [
      {
        scheme: "exact",
        network: networkId,
        maxAmountRequired: String(config.price),
        payTo: config.payTo,
        asset: assetAddress,
      },
    ],
    memo: config.paymentDescription,
    expiresAt,
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decode an x402 payment-required header value back to a structured payload.
 */
export function decodeX402Header(headerValue: string): X402PaymentRequiredPayload | null {
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(json) as X402PaymentRequiredPayload;
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable price string for display in storefronts.
 * Examples:
 *   formatPrice(1_000_000, "USDC") → "$1.00 USDC"
 *   formatPrice(100_000, "USDC")   → "$0.10 USDC"
 *   formatPrice(1_000_000_000_000_000, "ETH") → "0.001 ETH"
 */
export function formatX402Price(price: number, asset: string): string {
  const assetUpper = asset.toUpperCase();
  if (assetUpper === "USDC" || assetUpper === "USDT" || assetUpper === "DAI") {
    // 6 decimal places for most stablecoins
    const dollars = price / 1_000_000;
    return `$${dollars.toFixed(2)} ${assetUpper}`;
  }
  if (assetUpper === "ETH" || assetUpper === "MATIC" || assetUpper === "SOL") {
    // 18 decimals for ETH / EVM native; 9 for SOL
    const decimals = assetUpper === "SOL" ? 9 : 18;
    const units = price / Math.pow(10, decimals);
    return `${units.toPrecision(4)} ${assetUpper}`;
  }
  return `${price} ${assetUpper}`;
}

/**
 * Format an MSRP in USD cents to a display string.
 * Examples:
 *   formatMsrp(0)     → "Free"
 *   formatMsrp(99)    → "$0.99"
 *   formatMsrp(2900)  → "$29.00"
 *   formatMsrp(10000) → "$100.00"
 */
export function formatMsrp(msrpCents: number): string {
  if (msrpCents === 0) return "Free";
  const dollars = msrpCents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Build a public-facing storefront card for a warehouse item.
 * Returns a structured object suitable for display in a customer-facing UI.
 */
export function buildStorefrontCard(item: {
  id: string;
  title: string;
  description: string;
  productId?: string;
  msrp?: number;
  keywords?: string[];
  tags: string[];
  type: string;
  commerce?: CommerceConfig;
}): Record<string, unknown> {
  const msrpDisplay = item.msrp !== undefined ? formatMsrp(item.msrp) : null;

  const paymentOptions: string[] = [];
  if (item.commerce?.x402?.enabled) {
    paymentOptions.push(
      `x402 (${formatX402Price(item.commerce.x402.price, item.commerce.x402.asset)} per ${item.commerce.x402.paymentType})`
    );
  }
  if (item.commerce?.creem) {
    paymentOptions.push(`Creem fiat checkout (${formatMsrp(item.commerce.creem.priceUsdCents)})`);
  }
  if (item.commerce?.polar) {
    paymentOptions.push(
      item.commerce.polar.isFree
        ? "Polar (free/open access)"
        : `Polar (${formatMsrp(item.commerce.polar.priceUsdCents)})`
    );
  }

  return {
    id: item.id,
    productId: item.productId ?? null,
    title: item.title,
    description: item.description,
    type: item.type,
    msrp: item.msrp ?? null,
    msrpDisplay,
    keywords: item.keywords ?? [],
    tags: item.tags,
    paymentOptions,
    isForSale: paymentOptions.length > 0,
    commerceEnabled: {
      x402: item.commerce?.x402?.enabled ?? false,
      creem: !!item.commerce?.creem,
      polar: !!item.commerce?.polar,
    },
  };
}

/**
 * Validate that a CommerceConfig is minimally complete before saving.
 * Returns an array of validation error strings (empty = valid).
 */
export function validateCommerceConfig(config: Partial<CommerceConfig>): string[] {
  const errors: string[] = [];

  if (config.x402) {
    const { x402 } = config;
    if (x402.enabled) {
      if (!x402.payTo || x402.payTo.length < 10) {
        errors.push("x402.payTo must be a valid wallet address");
      }
      if (typeof x402.price !== "number" || x402.price <= 0) {
        errors.push("x402.price must be a positive number (in smallest token units)");
      }
      if (!x402.asset) {
        errors.push("x402.asset must be specified (e.g. 'USDC', 'ETH')");
      }
      if (!x402.network) {
        errors.push("x402.network must be specified (e.g. 'base', 'ethereum')");
      }
    }
  }

  if (config.creem) {
    if (!config.creem.productId) {
      errors.push("creem.productId is required");
    }
    if (typeof config.creem.priceUsdCents !== "number" || config.creem.priceUsdCents < 0) {
      errors.push("creem.priceUsdCents must be a non-negative integer");
    }
  }

  if (config.polar) {
    if (!config.polar.productId) {
      errors.push("polar.productId is required");
    }
    if (!config.polar.organizationSlug) {
      errors.push("polar.organizationSlug is required");
    }
    if (!config.polar.isFree) {
      if (typeof config.polar.priceUsdCents !== "number" || config.polar.priceUsdCents < 0) {
        errors.push("polar.priceUsdCents must be a non-negative integer (or set isFree: true)");
      }
    }
  }

  return errors;
}
