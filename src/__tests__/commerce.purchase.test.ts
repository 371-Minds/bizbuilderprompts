import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  addToWarehouse,
  buildWarehouseCatalog,
  getWarehouseItemById,
  WAREHOUSE_DIR,
} from "../warehouse/catalog.js";
import type { WarehouseItem } from "../warehouse/types.js";
import {
  resolvePurchaseOffer,
  settlePurchase,
  resolveFacilitatorBase,
  FACILITATOR_ALLOWLIST,
  VERIFY_URL,
} from "../commerce/purchase.js";
import { decodeX402Header } from "../commerce/config.js";

// ── Catalog isolation: save and restore warehouse/index.json around all tests ─

const CATALOG_PATH = join(WAREHOUSE_DIR, "index.json");
let originalCatalogContent: string | null = null;

const READY_ID = "test-x402-ready-item";
const DRAFT_ID = "test-x402-draft-item";
const NOX402_ID = "test-no-x402-item";

const PAY_TO = "0x57C63D275C66345819E2116c93B5ee3Bb0f497b0";

function makeItem(overrides: Partial<WarehouseItem>): WarehouseItem {
  return {
    id: "test-item",
    type: "prompt",
    title: "Test Asset",
    description: "A test warehouse asset",
    targetRoles: [],
    useCase: "testing",
    status: "ready",
    linkedItems: [],
    tags: [],
    variables: [],
    filePath: join(WAREHOUSE_DIR, "index.json"), // replaced per-item below
    ...overrides,
  } as WarehouseItem;
}

beforeAll(() => {
  originalCatalogContent = existsSync(CATALOG_PATH)
    ? readFileSync(CATALOG_PATH, "utf-8")
    : null;

  addToWarehouse(
    makeItem({
      id: READY_ID,
      title: "Ready Priced Asset",
      filePath: join(WAREHOUSE_DIR, "index.json"),
      commerce: {
        x402: {
          enabled: true,
          price: 3_000_000,
          asset: "USDC",
          network: "base",
          payTo: PAY_TO,
          paymentType: "one-time",
          paymentDescription: "Test asset — single-purchase access",
        },
      },
    }),
  );
  addToWarehouse(
    makeItem({
      id: DRAFT_ID,
      title: "Draft Priced Asset",
      filePath: join(WAREHOUSE_DIR, "test-x402-draft-placeholder.md"),
      status: "draft",
      commerce: {
        x402: {
          enabled: true,
          price: 3_000_000,
          asset: "USDC",
          network: "base",
          payTo: PAY_TO,
          paymentType: "one-time",
        },
      },
    }),
  );
  addToWarehouse(makeItem({ id: NOX402_ID, title: "Plain Item", filePath: join(WAREHOUSE_DIR, "test-no-x402-placeholder.md") }));
});

afterAll(() => {
  if (originalCatalogContent !== null) {
    writeFileSync(CATALOG_PATH, originalCatalogContent, "utf-8");
  } else if (existsSync(CATALOG_PATH)) {
    writeFileSync(
      CATALOG_PATH,
      JSON.stringify({ items: [], bundles: [], lastUpdated: new Date().toISOString(), totalCount: 0 }, null, 2),
      "utf-8",
    );
  }
  buildWarehouseCatalog();
});

// ── Facilitator fetch guard ──────────────────────────────────────────────────

describe("resolveFacilitatorBase", () => {
  it("accepts every allowlisted facilitator", () => {
    for (const base of FACILITATOR_ALLOWLIST) {
      expect(resolveFacilitatorBase(base)).toBe(base);
    }
  });

  it("rejects non-http(s) schemes", () => {
    expect(resolveFacilitatorBase("file:///etc/passwd")).toBeNull();
    expect(resolveFacilitatorBase("ftp://x402.org")).toBeNull();
    expect(resolveFacilitatorBase("javascript:alert(1)")).toBeNull();
  });

  it("rejects hosts outside the allowlist, including look-alikes", () => {
    expect(resolveFacilitatorBase("https://evil.example.com/verify")).toBeNull();
    expect(resolveFacilitatorBase("https://x402.org.evil.com")).toBeNull();
    expect(resolveFacilitatorBase("http://localhost:9999")).toBeNull();
  });

  it("resolves the canonical allowlisted base regardless of path/query", () => {
    expect(resolveFacilitatorBase("https://x402.org/some/path?q=1")).toBe("https://x402.org");
  });

  it("verify URL is derived from the allowlisted default", () => {
    expect(VERIFY_URL).toBe(`${FACILITATOR_ALLOWLIST[0]}/verify`);
  });
});

// ── Offer resolution (GET /warehouse/buy/:id) ────────────────────────────────

describe("resolvePurchaseOffer", () => {
  it("returns an offer with a decodable X-PAYMENT-REQUIRED header for a ready priced item", () => {
    const offer = resolvePurchaseOffer(READY_ID);
    expect(offer.kind).toBe("offer");
    if (offer.kind !== "offer") return;

    const decoded = decodeX402Header(offer.header);
    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe("1.0");
    expect(decoded!.accepts).toHaveLength(1);
    expect(decoded!.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      maxAmountRequired: "3000000",
      payTo: PAY_TO,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(decoded!.memo).toContain("single-purchase");
  });

  it("exposes a storefront card and payment instructions", () => {
    const offer = resolvePurchaseOffer(READY_ID);
    expect(offer.kind).toBe("offer");
    if (offer.kind !== "offer") return;
    expect(offer.storefrontCard).toMatchObject({ id: READY_ID, isForSale: true });
    expect(offer.instructions.priceDisplay).toBe("$3.00 USDC");
    expect(offer.instructions.payTo).toBe(PAY_TO);
    expect(offer.instructions.howToPay).toContain("X-PAYMENT");
  });

  it("returns not-found for an unknown item", () => {
    expect(resolvePurchaseOffer("no-such-item")).toEqual({ kind: "not-found" });
  });

  it("returns conflict for a non-ready item", () => {
    const offer = resolvePurchaseOffer(DRAFT_ID);
    expect(offer.kind).toBe("conflict");
    if (offer.kind === "conflict") {
      expect(offer.reason).toContain("not ready");
      expect(offer.status).toBe("draft");
    }
  });

  it("returns conflict for an item without x402 config", () => {
    const offer = resolvePurchaseOffer(NOX402_ID);
    expect(offer.kind).toBe("conflict");
    if (offer.kind === "conflict") {
      expect(offer.reason).toContain("not for sale");
    }
  });
});

// ── Settlement (POST /warehouse/buy/:id) ─────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function settlementEnv() {
  const ledgerDir = mkdtempSync(join(tmpdir(), "x402-test-"));
  const ledgerPath = join(ledgerDir, "sales.jsonl");
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    return jsonResponse(200, {
      isValid: true,
      payer: "0xPayer",
      txHash: "0xabc123",
    }) as unknown as Response;
  }) as typeof fetch;
  return { ledgerDir, ledgerPath, fetchCalls, fetchImpl };
}

describe("settlePurchase", () => {
  const X_PAYMENT = Buffer.from(JSON.stringify({ signature: "0xdeadbeef" })).toString("base64");

  it("fulfills a verified payment: content, ledger append, interbeing event", async () => {
    const env = settlementEnv();
    const result = await settlePurchase(READY_ID, X_PAYMENT, {
      fetchImpl: env.fetchImpl,
      ledgerPath: env.ledgerPath,
      now: () => new Date("2026-08-24T00:00:00Z"),
    });

    expect(result.kind).toBe("fulfilled");
    if (result.kind !== "fulfilled") return;
    expect(result.sale).toEqual({
      ts: "2026-08-24T00:00:00.000Z",
      itemId: READY_ID,
      title: "Ready Priced Asset",
      amount: 3_000_000,
      asset: "USDC",
      txHash: "0xabc123",
      network: "base",
    });
    expect(typeof result.content).toBe("string");
    expect(result.content!.length).toBeGreaterThan(0);

    const ledger = readFileSync(env.ledgerPath, "utf-8").trim().split("\n");
    expect(ledger).toHaveLength(1);
    expect(JSON.parse(ledger[0])).toEqual(result.sale);

    expect(env.fetchCalls).toHaveLength(2);
    const [verify, event] = env.fetchCalls;
    expect(verify.url).toBe(VERIFY_URL);
    expect(verify.init?.method).toBe("POST");
    expect(JSON.parse(String(verify.init?.body))).toMatchObject({ paymentPayload: X_PAYMENT });
    expect(event.url).toBe("http://127.0.0.1:3710/api/events");
    expect(JSON.parse(String(event.init?.body))).toMatchObject({
      type: "warehouse.sale",
      source: "bizbuilderprompts",
      itemId: READY_ID,
    });
  });

  it("rejects a payment the facilitator marks invalid", async () => {
    const env = settlementEnv();
    const fetchImpl = (async () =>
      jsonResponse(200, { isValid: false, invalidReason: "invalid_signature", invalidMessage: "bad sig" })) as typeof fetch;
    const result = await settlePurchase(READY_ID, X_PAYMENT, {
      fetchImpl,
      ledgerPath: env.ledgerPath,
    });
    expect(result.kind).toBe("invalid-payment");
    expect(result.reason).toContain("bad sig");
    expect(existsSync(env.ledgerPath)).toBe(false);
  });

  it("maps a facilitator HTTP error to facilitator-error without ledger append", async () => {
    const env = settlementEnv();
    const fetchImpl = (async () => jsonResponse(502, {})) as typeof fetch;
    const result = await settlePurchase(READY_ID, X_PAYMENT, {
      fetchImpl,
      ledgerPath: env.ledgerPath,
    });
    expect(result.kind).toBe("facilitator-error");
    expect(existsSync(env.ledgerPath)).toBe(false);
  });

  it("requires an X-PAYMENT header", async () => {
    const env = settlementEnv();
    const result = await settlePurchase(READY_ID, null, {
      fetchImpl: env.fetchImpl,
      ledgerPath: env.ledgerPath,
    });
    expect(result.kind).toBe("payment-required");
    expect(env.fetchCalls).toHaveLength(0);
  });

  it("rejects a malformed X-PAYMENT header before any fetch", async () => {
    const env = settlementEnv();
    const result = await settlePurchase(READY_ID, "!!!not-base64-json!!!", {
      fetchImpl: env.fetchImpl,
      ledgerPath: env.ledgerPath,
    });
    expect(result.kind).toBe("invalid-payment");
    expect(env.fetchCalls).toHaveLength(0);
  });

  it("returns not-found for an unknown item", async () => {
    const result = await settlePurchase("no-such-item", X_PAYMENT, {});
    expect(result.kind).toBe("not-found");
  });

  it("returns conflict for a draft item", async () => {
    const result = await settlePurchase(DRAFT_ID, X_PAYMENT, {});
    expect(result.kind).toBe("conflict");
  });

  it("survives an unreachable Interbeing events endpoint (fire-and-forget)", async () => {
    const env = settlementEnv();
    const failingEvents = (async (url: string) => {
      if (url.includes("3710")) throw new Error("connection refused");
      return jsonResponse(200, { isValid: true, txHash: "0xabc" }) as unknown as Response;
    }) as typeof fetch;
    const result = await settlePurchase(READY_ID, X_PAYMENT, {
      fetchImpl: failingEvents,
      ledgerPath: env.ledgerPath,
    });
    expect(result.kind).toBe("fulfilled");
    expect(existsSync(env.ledgerPath)).toBe(true);
  });
});

afterAll(() => {
  // best-effort cleanup of temp ledgers is handled by the OS tmp reaper; nothing to do here
});
