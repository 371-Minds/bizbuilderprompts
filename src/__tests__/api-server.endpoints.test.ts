import { describe, it, expect, beforeAll } from "vitest";
import { createServer } from "node:http";
import { X402_PAY_TO } from "../commerce/config.js";

/**
 * Endpoint tests for the x402 revenue rail on :8003.
 * Boots dist-free: imports src/api-server.ts with PORT pointed at an
 * ephemeral port, then exercises healthz / skus / gated 402 delivery.
 */

const GATED_ITEM = "warehouse-extracted-start-with-one-reader-problem-mt38e0w2";
const UNGATED_ITEM = "warehouse-prompt-give-ai-audience-context-upfront";

let base = "";

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

beforeAll(async () => {
  const port = await freePort();
  process.env.PORT = String(port);
  base = `http://127.0.0.1:${port}`;
  await import("../api-server.js");
});

describe("GET /healthz", () => {
  it("returns 200 with JSON status", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.prompts).toBe("number");
  });
});

describe("GET /skus", () => {
  it("returns the public catalog with id, title, price, network per SKU", async () => {
    const res = await fetch(`${base}/skus`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.skus.length).toBe(body.count);
    for (const sku of body.skus) {
      expect(typeof sku.id).toBe("string");
      expect(typeof sku.title).toBe("string");
      expect(typeof sku.price).toBe("number");
      expect(typeof sku.network).toBe("string");
    }
    const gated = body.skus.find((s: { id: string }) => s.id === GATED_ITEM);
    expect(gated).toMatchObject({ price: 3_000_000, network: "base" });
  });
});

describe("gated delivery — 402 Payment Required", () => {
  it("GET /warehouse/:id on a sellable item emits 402 with the x402 challenge", async () => {
    const res = await fetch(`${base}/warehouse/${GATED_ITEM}`);
    expect(res.status).toBe(402);
    expect(res.headers.get("x-payment-required")).toBeTruthy();

    const body = await res.json();
    expect(body.error).toBe("X402 Payment Required");
    expect(body.x402Version).toBe(1);
    expect(Array.isArray(body.accepts)).toBe(true);

    const header = res.headers.get("x-payment-required")!;
    const payload = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    expect(payload.version).toBe("1.0");
    // payTo inherited from the centralized commerce config, not per-SKU data.
    expect(payload.accepts[0].payTo).toBe(X402_PAY_TO);
    expect(payload.accepts[0].scheme).toBe("exact");
    expect(body.content).toBeUndefined();
  });

  it("GET /warehouse/buy/:id still emits the canonical 402 offer", async () => {
    const res = await fetch(`${base}/warehouse/buy/${GATED_ITEM}`);
    expect(res.status).toBe(402);
    expect(res.headers.get("x-payment-required")).toBeTruthy();
    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.payment.payTo).toBe(X402_PAY_TO);
  });

  it("POST /warehouse/buy/:id without payment is rejected 402 with the challenge re-attached", async () => {
    const res = await fetch(`${base}/warehouse/buy/${GATED_ITEM}`, { method: "POST" });
    expect(res.status).toBe(402);
    expect(res.headers.get("x-payment-required")).toBeTruthy();
    const body = await res.json();
    expect(body.error).toContain("X-PAYMENT");
  });

  it("ungated items remain freely retrievable (zero-downtime)", async () => {
    const res = await fetch(`${base}/warehouse/${UNGATED_ITEM}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metadata.id).toBe(UNGATED_ITEM);
  });
});
