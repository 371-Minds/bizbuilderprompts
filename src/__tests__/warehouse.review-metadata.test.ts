import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  addToWarehouse,
  getWarehouseItemById,
  updateWarehouseItem,
  buildWarehouseCatalog,
  WAREHOUSE_DIR,
} from "../warehouse/catalog.js";
import type { WarehouseItem } from "../warehouse/types.js";

// ── Catalog isolation: save and restore warehouse/index.json around all tests ─

const CATALOG_PATH = join(WAREHOUSE_DIR, "index.json");

let originalCatalogContent: string | null = null;

beforeAll(() => {
  originalCatalogContent = existsSync(CATALOG_PATH)
    ? readFileSync(CATALOG_PATH, "utf-8")
    : null;
});

afterAll(() => {
  if (originalCatalogContent !== null) {
    writeFileSync(CATALOG_PATH, originalCatalogContent, "utf-8");
  } else if (existsSync(CATALOG_PATH)) {
    writeFileSync(
      CATALOG_PATH,
      JSON.stringify({ items: [], bundles: [], lastUpdated: new Date().toISOString(), totalCount: 0 }, null, 2),
      "utf-8"
    );
  }
  buildWarehouseCatalog();
});

// ── review_draft review-metadata write ────────────────────────────────────────

describe("review metadata write (review_draft)", () => {
  it("persists review metadata on the warehouse item", () => {
    const id = `test-review-meta-${Date.now()}`;
    const item: WarehouseItem = {
      id,
      type: "prompt",
      title: "Review Metadata Test Item",
      description: "Item whose review metadata is captured",
      targetRoles: [],
      useCase: "Testing review metadata capture",
      status: "draft",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/review-meta-test.md",
    };
    addToWarehouse(item);

    // Mirrors the review_draft handler's metadata write after a successful review
    const reviewedAt = new Date().toISOString();
    const ok = updateWarehouseItem(id, {
      status: "ready",
      review: {
        verdict: "APPROVE",
        reviewedAt,
        reviewers: ["rune-pattern", "alex-clo"],
        notes: "Fidelity and license checks passed.",
        transcriptExcerpt: "Rune: pattern matches source... VERDICT: APPROVE",
      },
    });

    expect(ok).toBe(true);

    const retrieved = getWarehouseItemById(id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.status).toBe("ready");
    expect(retrieved!.review).toBeDefined();
    expect(retrieved!.review!.verdict).toBe("APPROVE");
    expect(retrieved!.review!.reviewedAt).toBe(reviewedAt);
    expect(retrieved!.review!.reviewers).toEqual(["rune-pattern", "alex-clo"]);
    expect(retrieved!.review!.notes).toBe("Fidelity and license checks passed.");
    expect(retrieved!.review!.transcriptExcerpt).toContain("VERDICT: APPROVE");
  });

  it("keeps review metadata intact on later partial updates", () => {
    const id = `test-review-meta-persist-${Date.now()}`;
    const item: WarehouseItem = {
      id,
      type: "prompt",
      title: "Review Metadata Persist Test",
      description: "Metadata must survive subsequent updates",
      targetRoles: [],
      useCase: "Testing metadata persistence",
      status: "draft",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/review-meta-persist.md",
    };
    addToWarehouse(item);

    updateWarehouseItem(id, {
      review: {
        verdict: "REVISE",
        reviewedAt: new Date().toISOString(),
        reviewers: ["rune-pattern"],
        notes: "Tighten the hook.",
        transcriptExcerpt: "VERDICT: REVISE",
      },
    });
    updateWarehouseItem(id, { tags: ["reviewed"] });

    const retrieved = getWarehouseItemById(id);
    expect(retrieved!.tags).toEqual(["reviewed"]);
    expect(retrieved!.review).toBeDefined();
    expect(retrieved!.review!.verdict).toBe("REVISE");
  });

  it("overwrites review metadata on re-review", () => {
    const id = `test-review-meta-rereview-${Date.now()}`;
    const item: WarehouseItem = {
      id,
      type: "prompt",
      title: "Re-Review Metadata Test",
      description: "Latest review wins",
      targetRoles: [],
      useCase: "Testing re-review overwrite",
      status: "draft",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/review-meta-rereview.md",
    };
    addToWarehouse(item);

    updateWarehouseItem(id, {
      review: {
        verdict: "REVISE",
        reviewedAt: new Date().toISOString(),
        reviewers: ["rune-pattern"],
        notes: "first pass",
        transcriptExcerpt: "VERDICT: REVISE",
      },
    });
    updateWarehouseItem(id, {
      status: "ready",
      review: {
        verdict: "APPROVE",
        reviewedAt: new Date().toISOString(),
        reviewers: ["rune-pattern", "alex-clo"],
        notes: "second pass",
        transcriptExcerpt: "VERDICT: APPROVE",
      },
    });

    const retrieved = getWarehouseItemById(id);
    expect(retrieved!.status).toBe("ready");
    expect(retrieved!.review!.verdict).toBe("APPROVE");
    expect(retrieved!.review!.notes).toBe("second pass");
  });
});
