/**
 * x402 Bazaar discovery for the warehouse.
 *
 * Per x402-foundation/x402 docs/extensions/bazaar.mdx:
 *  - resources carry payment `accepts` + `extensions.bazaar.info`
 *    (input.type "http", method, queryParams, output example)
 *  - routeTemplate consolidation collapses parameterized routes; the
 *    warehouse sells DISTINCT goods at per-id paths, so resources are
 *    declared static (no routeTemplate) to keep per-product catalog rows.
 *  - server declaration alone catalogs nothing: indexing happens when a
 *    paying client echoes the bazaar extension at settlement. The 402 body
 *    therefore carries the same extensions object for clients to echo.
 *
 * Payment terms are not re-derived here — accepts are decoded from the live
 * X-PAYMENT-REQUIRED offer per item, so discovery always matches the till.
 */

import type { WarehouseItem } from "./types.js";

export interface BazaarInput {
  baseUrl: string
  items: WarehouseItem[]
  bundles?: { id: string, title: string, itemCount: number }[]
  resolveOfferAccepts: (id: string) => unknown | null
}

const SERVICE_NAME = "371 Warehouse"
const SERVICE_TAGS = ["prompts", "ai-content", "marketing", "plr", "workflows"]

function decodeAccepts(header: string): unknown | null {
  try {
    const payload = JSON.parse(Buffer.from(header, "base64").toString("utf-8"))
    return payload.accepts ?? null
  } catch {
    return null
  }
}

export function buildBazaarDiscovery(input: BazaarInput) {
  const base = input.baseUrl.replace(/\/$/, "")
  const sellable = input.items.filter(i => i.status !== "draft")
  const resources = sellable.map((item) => {
    const resource = `${base}/warehouse/buy/${item.id}`
    const accepts = input.resolveOfferAccepts(item.id)
    const bazaarInfo = {
      input: { type: "http", method: "POST", queryParams: [] },
      output: {
        type: "application/json",
        example: {
          itemId: item.id,
          title: item.title,
          sale: { txHash: "<settlement>", network: "base", amount: item.msrp },
          content: "<full asset after settlement>",
        },
      },
    }
    return {
      resource,
      type: "http",
      method: "POST",
      x402Version: 1,
      ...(accepts ? { accepts } : {}),
      extensions: { bazaar: { info: bazaarInfo } },
      metadata: {
        serviceName: SERVICE_NAME,
        tags: (item.tags ?? []).slice(0, 5).map((t: string) => t.slice(0, 32)),
        title: item.title,
        description: item.description,
      },
      lastUpdated: new Date().toISOString(),
    }
  })
  return {
    x402Version: 1,
    serviceName: SERVICE_NAME,
    tags: SERVICE_TAGS,
    resourceCount: resources.length,
    resources,
    ...(input.bundles?.length ? { bundles: input.bundles } : {}),
    note: "Static per-product resources (no routeTemplate) — distinct goods must not consolidate. Indexing requires settlement echo via facilitator.",
  }
}

/** The per-item extensions object embedded in 402 offer bodies (echo bait). */
export function bazaarExtensionFor(item: WarehouseItem, baseUrl: string) {
  return {
    bazaar: {
      info: {
        input: { type: "http", method: "POST", queryParams: [] },
        output: {
          type: "application/json",
          example: {
            itemId: item.id,
            title: item.title,
            sale: { txHash: "<settlement>", network: "base", amount: item.msrp },
            content: "<full asset after settlement>",
          },
        },
      },
    },
  }
}
