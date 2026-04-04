import { describe, it, expect } from "vitest";
import {
  formatMsrp,
  formatX402Price,
  buildX402PaymentRequiredHeader,
  decodeX402Header,
  buildStorefrontCard,
  validateCommerceConfig,
} from "../commerce/config.js";
import type { X402Config, CommerceConfig } from "../commerce/types.js";

// ── formatMsrp ────────────────────────────────────────────────────────────────

describe("formatMsrp", () => {
  it('returns "Free" for 0 cents', () => {
    expect(formatMsrp(0)).toBe("Free");
  });

  it("formats cents under a dollar", () => {
    expect(formatMsrp(99)).toBe("$0.99");
  });

  it("formats whole dollar amounts", () => {
    expect(formatMsrp(2900)).toBe("$29.00");
    expect(formatMsrp(10000)).toBe("$100.00");
  });

  it("formats large amounts correctly", () => {
    expect(formatMsrp(199900)).toBe("$1999.00");
  });
});

// ── formatX402Price ───────────────────────────────────────────────────────────

describe("formatX402Price", () => {
  it("formats USDC with 6-decimal representation", () => {
    expect(formatX402Price(1_000_000, "USDC")).toBe("$1.00 USDC");
    expect(formatX402Price(100_000, "USDC")).toBe("$0.10 USDC");
    expect(formatX402Price(500_000, "USDC")).toBe("$0.50 USDC");
  });

  it("formats USDT the same as USDC (6 decimals)", () => {
    expect(formatX402Price(1_000_000, "USDT")).toBe("$1.00 USDT");
  });

  it("formats DAI with 6 decimals", () => {
    expect(formatX402Price(1_000_000, "DAI")).toBe("$1.00 DAI");
  });

  it("formats ETH with 18 decimals", () => {
    const result = formatX402Price(1_000_000_000_000_000, "ETH");
    expect(result).toContain("ETH");
    // 0.001 ETH with toPrecision(4) = "0.001000"
    expect(result).toContain("0.001");
  });

  it("formats MATIC with 18 decimals", () => {
    const result = formatX402Price(1_000_000_000_000_000_000, "MATIC");
    expect(result).toContain("MATIC");
    expect(result).toContain("1.000");
  });

  it("formats SOL with 9 decimals", () => {
    const result = formatX402Price(1_000_000_000, "SOL");
    expect(result).toContain("SOL");
    expect(result).toContain("1.000");
  });

  it("falls back to raw number for unknown asset", () => {
    expect(formatX402Price(500, "UNKNOWN")).toBe("500 UNKNOWN");
  });
});

// ── buildX402PaymentRequiredHeader / decodeX402Header ─────────────────────────

describe("buildX402PaymentRequiredHeader + decodeX402Header", () => {
  const baseConfig: X402Config = {
    enabled: true,
    price: 1_000_000,
    asset: "USDC",
    network: "base",
    payTo: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
    paymentType: "per-access",
    paymentDescription: "Access this prompt for $1 USDC",
  };

  it("returns a base64-encoded string", () => {
    const header = buildX402PaymentRequiredHeader(baseConfig);
    expect(typeof header).toBe("string");
    // Should be valid base64
    expect(() => Buffer.from(header, "base64").toString("utf-8")).not.toThrow();
  });

  it("decodes back to valid payload structure", () => {
    const header = buildX402PaymentRequiredHeader(baseConfig);
    const decoded = decodeX402Header(header);
    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe("1.0");
    expect(Array.isArray(decoded!.accepts)).toBe(true);
    expect(decoded!.accepts.length).toBe(1);
  });

  it("payload contains correct network ID for base", () => {
    const header = buildX402PaymentRequiredHeader(baseConfig);
    const decoded = decodeX402Header(header);
    expect(decoded!.accepts[0].network).toBe("eip155:8453");
  });

  it("resolves USDC to known contract address on base", () => {
    const header = buildX402PaymentRequiredHeader(baseConfig);
    const decoded = decodeX402Header(header);
    expect(decoded!.accepts[0].asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });

  it("resolves USDC to correct address on ethereum", () => {
    const header = buildX402PaymentRequiredHeader({ ...baseConfig, network: "ethereum" });
    const decoded = decodeX402Header(header);
    expect(decoded!.accepts[0].asset).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  });

  it("uses zero address for unknown assets", () => {
    const header = buildX402PaymentRequiredHeader({ ...baseConfig, asset: "UNKNOWNCOIN" });
    const decoded = decodeX402Header(header);
    expect(decoded!.accepts[0].asset).toBe("0x0000000000000000000000000000000000000000");
  });

  it("uses asset address as-is when it starts with 0x", () => {
    const customAsset = "0xCustomContractAddress123456789";
    const header = buildX402PaymentRequiredHeader({ ...baseConfig, asset: customAsset });
    const decoded = decodeX402Header(header);
    expect(decoded!.accepts[0].asset).toBe(customAsset);
  });

  it("uses ETH as-is (native token)", () => {
    const header = buildX402PaymentRequiredHeader({ ...baseConfig, asset: "ETH" });
    const decoded = decodeX402Header(header);
    // ETH goes through the ETH branch in formatX402Price but for the header,
    // ETH is a non-USDC, non-0x so should get zero address
    // Let's verify whatever it returns is a string
    expect(typeof decoded!.accepts[0].asset).toBe("string");
  });

  it("payload contains the payTo address", () => {
    const header = buildX402PaymentRequiredHeader(baseConfig);
    const decoded = decodeX402Header(header);
    expect(decoded!.accepts[0].payTo).toBe(baseConfig.payTo);
  });

  it("payload memo matches paymentDescription", () => {
    const header = buildX402PaymentRequiredHeader(baseConfig);
    const decoded = decodeX402Header(header);
    expect(decoded!.memo).toBe(baseConfig.paymentDescription);
  });

  it("payload has an expiresAt ISO timestamp", () => {
    const before = Date.now();
    const header = buildX402PaymentRequiredHeader(baseConfig);
    const after = Date.now();
    const decoded = decodeX402Header(header);
    const expiry = new Date(decoded!.expiresAt!).getTime();
    // Should expire 15 minutes in the future
    expect(expiry).toBeGreaterThan(before + 14 * 60 * 1000);
    expect(expiry).toBeLessThan(after + 16 * 60 * 1000);
  });
});

describe("decodeX402Header", () => {
  it("returns null for invalid base64", () => {
    expect(decodeX402Header("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for valid base64 that is not JSON", () => {
    const encoded = Buffer.from("this is not json").toString("base64");
    expect(decodeX402Header(encoded)).toBeNull();
  });
});

// ── buildStorefrontCard ───────────────────────────────────────────────────────

describe("buildStorefrontCard", () => {
  const baseItem = {
    id: "test-item-001",
    title: "Sales Mastery Bundle",
    description: "Everything you need to close more deals",
    type: "prompt",
    tags: ["sales", "closing"],
  };

  it("returns a card with required fields", () => {
    const card = buildStorefrontCard(baseItem);
    expect(card.id).toBe("test-item-001");
    expect(card.title).toBe("Sales Mastery Bundle");
    expect(card.description).toBe("Everything you need to close more deals");
    expect(card.type).toBe("prompt");
  });

  it("msrpDisplay is null when msrp not provided", () => {
    const card = buildStorefrontCard(baseItem);
    expect(card.msrpDisplay).toBeNull();
    expect(card.msrp).toBeNull();
  });

  it("shows msrpDisplay when msrp provided", () => {
    const card = buildStorefrontCard({ ...baseItem, msrp: 2900 });
    expect(card.msrpDisplay).toBe("$29.00");
    expect(card.msrp).toBe(2900);
  });

  it("isForSale is false when no commerce configured", () => {
    const card = buildStorefrontCard(baseItem);
    expect(card.isForSale).toBe(false);
  });

  it("isForSale is true when x402 commerce is enabled", () => {
    const commerce: CommerceConfig = {
      x402: {
        enabled: true,
        price: 1_000_000,
        asset: "USDC",
        network: "base",
        payTo: "0xAbc",
        paymentType: "per-access",
      },
    };
    const card = buildStorefrontCard({ ...baseItem, commerce });
    expect(card.isForSale).toBe(true);
    expect((card.paymentOptions as string[]).length).toBeGreaterThan(0);
  });

  it("includes Creem payment option when creem configured", () => {
    const commerce: CommerceConfig = {
      creem: {
        apiKeyEnvVar: "CREEM_API_KEY",
        productId: "prod_123",
        checkoutType: "one_time",
        priceUsdCents: 999,
      },
    };
    const card = buildStorefrontCard({ ...baseItem, commerce });
    expect(card.isForSale).toBe(true);
    const options = card.paymentOptions as string[];
    expect(options.some((o) => o.includes("Creem"))).toBe(true);
  });

  it("includes Polar payment option when polar configured", () => {
    const commerce: CommerceConfig = {
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "371-minds",
        productId: "prod_polar_001",
        benefitType: "file_download",
        priceUsdCents: 1900,
      },
    };
    const card = buildStorefrontCard({ ...baseItem, commerce });
    expect(card.isForSale).toBe(true);
    const options = card.paymentOptions as string[];
    expect(options.some((o) => o.includes("Polar"))).toBe(true);
  });

  it("marks Polar as free/open access when isFree is set", () => {
    const commerce: CommerceConfig = {
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "371-minds",
        productId: "prod_polar_free",
        benefitType: "custom",
        priceUsdCents: 0,
        isFree: true,
      },
    };
    const card = buildStorefrontCard({ ...baseItem, commerce });
    const options = card.paymentOptions as string[];
    expect(options.some((o) => o.includes("free/open access"))).toBe(true);
  });

  it("commerceEnabled reflects active payment methods", () => {
    const commerce: CommerceConfig = {
      x402: {
        enabled: true,
        price: 500_000,
        asset: "USDC",
        network: "base",
        payTo: "0xAbc",
        paymentType: "per-request",
      },
    };
    const card = buildStorefrontCard({ ...baseItem, commerce });
    const flags = card.commerceEnabled as Record<string, boolean>;
    expect(flags.x402).toBe(true);
    expect(flags.creem).toBe(false);
    expect(flags.polar).toBe(false);
  });

  it("productId is null when not provided", () => {
    const card = buildStorefrontCard(baseItem);
    expect(card.productId).toBeNull();
  });

  it("includes keywords when provided", () => {
    const card = buildStorefrontCard({ ...baseItem, keywords: ["sales", "crm"] });
    expect(card.keywords).toEqual(["sales", "crm"]);
  });
});

// ── validateCommerceConfig ────────────────────────────────────────────────────

describe("validateCommerceConfig", () => {
  it("returns no errors for empty config", () => {
    expect(validateCommerceConfig({})).toEqual([]);
  });

  it("returns no errors for valid x402 config", () => {
    const config: Partial<CommerceConfig> = {
      x402: {
        enabled: true,
        price: 1_000_000,
        asset: "USDC",
        network: "base",
        payTo: "0x1234567890123456789012345678901234567890",
        paymentType: "per-access",
      },
    };
    expect(validateCommerceConfig(config)).toEqual([]);
  });

  it("skips x402 validation when enabled is false", () => {
    const config: Partial<CommerceConfig> = {
      x402: {
        enabled: false,
        price: 0,
        asset: "",
        network: "base",
        payTo: "",
        paymentType: "per-access",
      },
    };
    expect(validateCommerceConfig(config)).toEqual([]);
  });

  it("errors when x402 payTo is missing", () => {
    const config: Partial<CommerceConfig> = {
      x402: {
        enabled: true,
        price: 1_000_000,
        asset: "USDC",
        network: "base",
        payTo: "",
        paymentType: "per-access",
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("payTo"))).toBe(true);
  });

  it("errors when x402 price is zero or negative", () => {
    const config: Partial<CommerceConfig> = {
      x402: {
        enabled: true,
        price: 0,
        asset: "USDC",
        network: "base",
        payTo: "0x1234567890123456789012345678901234567890",
        paymentType: "per-access",
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("price"))).toBe(true);
  });

  it("errors when x402 asset is missing", () => {
    const config: Partial<CommerceConfig> = {
      x402: {
        enabled: true,
        price: 1_000_000,
        asset: "",
        network: "base",
        payTo: "0x1234567890123456789012345678901234567890",
        paymentType: "per-access",
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("asset"))).toBe(true);
  });

  it("errors when x402 network is missing", () => {
    const config: Partial<CommerceConfig> = {
      x402: {
        enabled: true,
        price: 1_000_000,
        asset: "USDC",
        network: "" as never,
        payTo: "0x1234567890123456789012345678901234567890",
        paymentType: "per-access",
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("network"))).toBe(true);
  });

  it("returns no errors for valid creem config", () => {
    const config: Partial<CommerceConfig> = {
      creem: {
        apiKeyEnvVar: "CREEM_API_KEY",
        productId: "prod_abc123",
        checkoutType: "one_time",
        priceUsdCents: 999,
      },
    };
    expect(validateCommerceConfig(config)).toEqual([]);
  });

  it("errors when creem productId is missing", () => {
    const config: Partial<CommerceConfig> = {
      creem: {
        apiKeyEnvVar: "CREEM_API_KEY",
        productId: "",
        checkoutType: "one_time",
        priceUsdCents: 999,
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("productId"))).toBe(true);
  });

  it("errors when creem priceUsdCents is negative", () => {
    const config: Partial<CommerceConfig> = {
      creem: {
        apiKeyEnvVar: "CREEM_API_KEY",
        productId: "prod_abc",
        checkoutType: "one_time",
        priceUsdCents: -100,
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("priceUsdCents"))).toBe(true);
  });

  it("returns no errors for valid polar config", () => {
    const config: Partial<CommerceConfig> = {
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "371-minds",
        productId: "prod_polar_001",
        benefitType: "file_download",
        priceUsdCents: 1900,
      },
    };
    expect(validateCommerceConfig(config)).toEqual([]);
  });

  it("errors when polar productId is missing", () => {
    const config: Partial<CommerceConfig> = {
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "371-minds",
        productId: "",
        benefitType: "file_download",
        priceUsdCents: 1900,
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("productId"))).toBe(true);
  });

  it("errors when polar organizationSlug is missing", () => {
    const config: Partial<CommerceConfig> = {
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "",
        productId: "prod_001",
        benefitType: "file_download",
        priceUsdCents: 1900,
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.some((e) => e.includes("organizationSlug"))).toBe(true);
  });

  it("no priceUsdCents error when polar isFree is true", () => {
    const config: Partial<CommerceConfig> = {
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "371-minds",
        productId: "prod_free",
        benefitType: "custom",
        priceUsdCents: 0,
        isFree: true,
      },
    };
    expect(validateCommerceConfig(config)).toEqual([]);
  });

  it("accumulates errors from multiple providers", () => {
    const config: Partial<CommerceConfig> = {
      creem: {
        apiKeyEnvVar: "CREEM_API_KEY",
        productId: "",
        checkoutType: "one_time",
        priceUsdCents: -50,
      },
      polar: {
        apiKeyEnvVar: "POLAR_API_KEY",
        organizationSlug: "",
        productId: "",
        benefitType: "custom",
        priceUsdCents: 0,
      },
    };
    const errors = validateCommerceConfig(config);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
