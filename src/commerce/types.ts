/**
 * Commerce types for customer-facing warehouse monetization.
 *
 * Supports three payment layers:
 *   1. x402  — HTTP-native micropayments for agentic / API access (onchain, per-request)
 *   2. Creem  — Fiat checkout for individual purchases and subscriptions
 *   3. Polar  — OSS-style benefit / sponsorship monetization
 *
 * Treasury routing goes through Mercury Bank (business banking).
 */

// ── x402 (HTTP 402 Payment Protocol) ──────────────────────────────────────────

/** Supported blockchain networks for x402 payments. */
export type X402Network =
  | "base"
  | "base-sepolia"
  | "ethereum"
  | "polygon"
  | "solana"
  | "optimism"
  | "arbitrum";

/** Payment model for x402-gated resources. */
export type X402PaymentType = "per-access" | "per-request" | "one-time" | "subscription";

/**
 * x402 payment configuration for a warehouse item.
 * When enabled, accessing this item via the public API requires an onchain payment.
 *
 * @see https://x402.org  /  https://docs.cdp.coinbase.com/x402/welcome
 */
export interface X402Config {
  /** Whether x402 paywall is active for this item. */
  enabled: boolean;
  /**
   * Price in the smallest unit of the payment asset.
   * For USDC (6 decimals): 1 USDC = 1_000_000, $0.10 = 100_000.
   * For ETH (18 decimals): 0.001 ETH = 1_000_000_000_000_000.
   */
  price: number;
  /** Payment asset symbol, e.g. "USDC", "ETH", "USDT". */
  asset: string;
  /** Blockchain network to settle payments on. */
  network: X402Network;
  /** Wallet address that receives payment. Usually the Mercury-linked address or a multisig. */
  payTo: string;
  /** Payment model — defaults to "per-access". */
  paymentType: X402PaymentType;
  /**
   * Optional: URL of a facilitator service that verifies and settles x402 payments.
   * Leave blank to use the Coinbase-hosted facilitator at https://x402.org/facilitator.
   */
  facilitatorUrl?: string;
  /**
   * Human-readable description shown in the 402 Payment Required response,
   * e.g. "Access this AI prompt template for $0.99 USDC".
   */
  paymentDescription?: string;
  /**
   * Optional: maximum number of concurrent payment authorizations to accept
   * before marking this item as sold out / rate-limited.
   */
  maxConcurrent?: number;
}

// ── Mercury Bank ──────────────────────────────────────────────────────────────

/**
 * Mercury Bank treasury configuration.
 * Mercury is the business bank where fiat receipts and crypto off-ramp proceeds land.
 *
 * @see https://mercury.com
 */
export interface MercuryConfig {
  /**
   * Mercury API key for programmatic access.
   * Store securely — never commit to source control.
   * Use the MERCURY_API_KEY environment variable.
   */
  apiKeyEnvVar: string; // env var name, not the value
  /** Mercury account ID (from the Mercury dashboard) to receive payments. */
  accountId?: string;
  /**
   * ACH routing number associated with this Mercury account.
   * Used for fiat transfers from Creem / Polar payouts.
   */
  routingNumber?: string;
  /** Account number for ACH deposits (use with caution). */
  accountNumber?: string;
  /** Human-readable label for this bank account (e.g. "BizBuilderPrompts Revenue"). */
  accountLabel?: string;
}

// ── Creem.io ──────────────────────────────────────────────────────────────────

/** Creem checkout / payment type. */
export type CreemCheckoutType = "one_time" | "recurring" | "usage_based";

/**
 * Creem.io product configuration.
 * Creem is a creator-focused fiat payment platform for selling digital products.
 *
 * @see https://creem.io
 */
export interface CreemConfig {
  /**
   * Creem API key env var name.
   * Set CREEM_API_KEY in the environment.
   */
  apiKeyEnvVar: string;
  /** Creem Product ID — created in the Creem dashboard or via the API. */
  productId: string;
  /** Creem Checkout URL for this product. */
  checkoutUrl?: string;
  /** Type of Creem checkout this product uses. */
  checkoutType: CreemCheckoutType;
  /** Price in USD cents (e.g. 99 = $0.99, 2900 = $29.00). */
  priceUsdCents: number;
  /**
   * Webhook endpoint path (relative, e.g. "/webhooks/creem")
   * that Creem calls on successful purchases.
   */
  webhookPath?: string;
  /**
   * Whether to automatically fulfill the order (deliver asset)
   * when Creem fires the purchase webhook.
   */
  autoFulfill?: boolean;
}

// ── Polar.sh ──────────────────────────────────────────────────────────────────

/** Polar benefit type — how the customer receives access. */
export type PolarBenefitType = "file_download" | "license_keys" | "custom" | "discord_roles";

/**
 * Polar.sh product configuration.
 * Polar is an open-source monetization platform for OSS maintainers and indie builders.
 *
 * @see https://polar.sh
 */
export interface PolarConfig {
  /**
   * Polar API key env var name.
   * Set POLAR_API_KEY in the environment.
   */
  apiKeyEnvVar: string;
  /** Polar Organization slug (e.g. "371-minds"). */
  organizationSlug: string;
  /** Polar Product ID. */
  productId: string;
  /** Polar checkout URL for this product. */
  checkoutUrl?: string;
  /** The type of benefit the buyer receives. */
  benefitType: PolarBenefitType;
  /** Price in USD cents. */
  priceUsdCents: number;
  /**
   * Whether this is a free/open product (sponsorship tier at $0).
   * If true, priceUsdCents is ignored and access is ungated.
   */
  isFree?: boolean;
  /**
   * Webhook endpoint path (relative, e.g. "/webhooks/polar")
   * that Polar calls on successful purchases.
   */
  webhookPath?: string;
}

// ── Unified Commerce Config ───────────────────────────────────────────────────

/**
 * Full commerce configuration for a warehouse item.
 * Attach this to any WarehouseItem to make it customer-facing.
 */
export interface CommerceConfig {
  /**
   * x402 configuration — enables HTTP 402 paywall for agentic / API access.
   * This is the primary payment method for AI agents consuming assets programmatically.
   */
  x402?: X402Config;
  /**
   * Creem.io configuration — enables fiat checkout for human buyers.
   */
  creem?: CreemConfig;
  /**
   * Polar.sh configuration — enables OSS-style monetization and benefit delivery.
   */
  polar?: PolarConfig;
  /**
   * Mercury Bank treasury routing for all payment proceeds.
   */
  mercury?: MercuryConfig;
}

// ── x402 HTTP Response Helpers ────────────────────────────────────────────────

/**
 * The payload returned in the `X-PAYMENT-REQUIRED` header (base64-encoded JSON)
 * when a client hits a 402-gated endpoint without payment.
 *
 * @see https://docs.cdp.coinbase.com/x402/welcome
 */
export interface X402PaymentRequiredPayload {
  /** The x402 protocol version. */
  version: "1.0";
  /** Payment instructions. */
  accepts: Array<{
    /** Payment scheme — "exact" for fixed-price assets. */
    scheme: "exact";
    /** Network identifier string (e.g. "eip155:8453" for Base mainnet). */
    network: string;
    /** Amount as a decimal string (e.g. "1000000" for 1 USDC). */
    maxAmountRequired: string;
    /** Recipient wallet address. */
    payTo: string;
    /** Token contract address (use zero address for native tokens). */
    asset: string;
    /** Hex-encoded extra data for the payment contract (optional). */
    extra?: string;
  }>;
  /** Human-readable description of what the payment unlocks. */
  memo?: string;
  /** ISO 8601 timestamp after which this payment offer expires. */
  expiresAt?: string;
}

/** Network ID mapping for x402 EIP-155 chain identifiers. */
export const X402_NETWORK_IDS: Record<X402Network, string> = {
  base: "eip155:8453",
  "base-sepolia": "eip155:84532",
  ethereum: "eip155:1",
  polygon: "eip155:137",
  optimism: "eip155:10",
  arbitrum: "eip155:42161",
  solana: "solana:mainnet",
};

/** Well-known ERC-20 token addresses per network (USDC). */
export const USDC_ADDRESSES: Partial<Record<X402Network, string>> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};
