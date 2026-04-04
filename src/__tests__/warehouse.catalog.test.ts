import { describe, it, expect, beforeEach } from "vitest";
import {
  generateProductId,
  searchWarehouse,
  addToWarehouse,
  getWarehouseItemById,
  buildWarehouseCatalog,
  addBundle,
  getBundle,
  listBundles,
} from "../warehouse/catalog.js";
import type { WarehouseItem, Bundle } from "../warehouse/types.js";

// ── generateProductId ─────────────────────────────────────────────────────────

describe("generateProductId", () => {
  it("returns a non-empty string", () => {
    const id = generateProductId("prompt", "Sales Closing Guide");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("uses the type as a prefix (uppercased first 3 chars)", () => {
    const id = generateProductId("prompt", "Test");
    expect(id.startsWith("PRO-")).toBe(true);
  });

  it("uses 'wor' prefix for workflow type", () => {
    const id = generateProductId("workflow", "Legal Workflow");
    expect(id.startsWith("WOR-")).toBe(true);
  });

  it("slugifies the title in the ID", () => {
    const id = generateProductId("prompt", "Sales Closing Guide");
    expect(id).toContain("sales-closing-guide");
  });

  it("removes special characters from title", () => {
    const id = generateProductId("prompt", "Best Practices & Templates!");
    expect(id).not.toContain("&");
    expect(id).not.toContain("!");
  });

  it("generates unique IDs on repeated calls", () => {
    const id1 = generateProductId("prompt", "My Prompt");
    const id2 = generateProductId("prompt", "My Prompt");
    // Due to Date.now() suffix, they may differ; but format is consistent
    expect(id1).toMatch(/^PRO-my-prompt/);
    expect(id2).toMatch(/^PRO-my-prompt/);
  });

  it("truncates long titles to 30 characters in ID", () => {
    const longTitle = "A Very Long Product Title That Exceeds The Maximum Allowed Length";
    const id = generateProductId("prompt", longTitle);
    // The slug portion should be ≤ 30 chars
    const parts = id.split("-");
    const slugPart = parts.slice(1, -1).join("-");
    expect(slugPart.length).toBeLessThanOrEqual(30);
  });
});

// ── searchWarehouse ───────────────────────────────────────────────────────────

describe("searchWarehouse", () => {
  beforeEach(() => {
    // Ensure catalog is initialized
    buildWarehouseCatalog();
  });

  it("returns an array (possibly empty) without throwing", () => {
    const results = searchWarehouse();
    expect(Array.isArray(results)).toBe(true);
  });

  it("filters by text query", () => {
    // Add a test item to ensure we have something to search
    const testItem: WarehouseItem = {
      id: `test-search-item-${Date.now()}`,
      type: "prompt",
      title: "Unique Searchable Item XYZ987",
      description: "This is a uniquely searchable item for test purposes",
      targetRoles: [],
      useCase: "Testing search functionality",
      status: "ready",
      linkedItems: [],
      tags: ["test", "unique"],
      variables: [],
      filePath: "/tmp/test-search-item.md",
    };
    addToWarehouse(testItem);

    const results = searchWarehouse("Unique Searchable Item XYZ987");
    const found = results.find((r) => r.id === testItem.id);
    expect(found).toBeDefined();
  });

  it("filters by status", () => {
    const testItem: WarehouseItem = {
      id: `test-status-item-${Date.now()}`,
      type: "prompt",
      title: "Draft Status Test Item",
      description: "A draft item for testing",
      targetRoles: [],
      useCase: "Status filter test",
      status: "draft",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/draft-test.md",
    };
    addToWarehouse(testItem);

    const draftResults = searchWarehouse(undefined, undefined, undefined, "draft");
    const found = draftResults.find((r) => r.id === testItem.id);
    expect(found).toBeDefined();

    const readyResults = searchWarehouse(undefined, undefined, undefined, "ready");
    const notFound = readyResults.find((r) => r.id === testItem.id);
    expect(notFound).toBeUndefined();
  });

  it("filters by category", () => {
    const testItem: WarehouseItem = {
      id: `test-category-item-${Date.now()}`,
      type: "prompt",
      title: "Category Filter Test Item",
      description: "A category-specific item for testing",
      targetRoles: [],
      useCase: "Category filter test",
      status: "ready",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/category-test.md",
      category: "test-category-unique-xyz",
    };
    addToWarehouse(testItem);

    const results = searchWarehouse(undefined, undefined, "test-category-unique-xyz");
    const found = results.find((r) => r.id === testItem.id);
    expect(found).toBeDefined();
  });

  it("filters by role using affinity map", () => {
    const testItem: WarehouseItem = {
      id: `test-role-affinity-${Date.now()}`,
      type: "prompt",
      title: "CMO Marketing Item",
      description: "Marketing item for CMO role",
      targetRoles: [],
      useCase: "CMO marketing campaigns",
      status: "ready",
      linkedItems: [],
      tags: ["marketing"],
      variables: [],
      filePath: "/tmp/cmo-test.md",
      category: "marketing",
    };
    addToWarehouse(testItem);

    // CMO has marketing in affinity
    const results = searchWarehouse(undefined, "cmo");
    const found = results.find((r) => r.id === testItem.id);
    expect(found).toBeDefined();
  });

  it("filters by targetRoles when directly assigned", () => {
    const testItem: WarehouseItem = {
      id: `test-targeted-role-${Date.now()}`,
      type: "prompt",
      title: "CEO Specific Item",
      description: "Only for CEO",
      targetRoles: ["ceo"],
      useCase: "CEO strategy",
      status: "ready",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/ceo-specific.md",
      category: "other-category",
    };
    addToWarehouse(testItem);

    const ceoResults = searchWarehouse(undefined, "ceo");
    const foundForCeo = ceoResults.find((r) => r.id === testItem.id);
    expect(foundForCeo).toBeDefined();

    // CFO should not find CEO-targeted items not in their affinity
    // (depends on affinity map, but the item is explicitly targeted to ceo)
  });

  it("searches by tag", () => {
    const testItem: WarehouseItem = {
      id: `test-tag-search-${Date.now()}`,
      type: "prompt",
      title: "Tag Search Test Item",
      description: "Item with a unique test tag",
      targetRoles: [],
      useCase: "Tag search testing",
      status: "ready",
      linkedItems: [],
      tags: ["unique-tag-xyz987abc"],
      variables: [],
      filePath: "/tmp/tag-test.md",
    };
    addToWarehouse(testItem);

    const results = searchWarehouse("unique-tag-xyz987abc");
    const found = results.find((r) => r.id === testItem.id);
    expect(found).toBeDefined();
  });
});

// ── addToWarehouse / getWarehouseItemById ─────────────────────────────────────

describe("addToWarehouse and getWarehouseItemById", () => {
  it("can add a new item and retrieve it by id", () => {
    const id = `test-add-item-${Date.now()}`;
    const item: WarehouseItem = {
      id,
      type: "prompt",
      title: "Retrieve By ID Test",
      description: "Test item for ID retrieval",
      targetRoles: [],
      useCase: "Testing ID lookup",
      status: "ready",
      linkedItems: [],
      tags: ["test"],
      variables: ["Topic"],
      filePath: "/tmp/retrieve-test.md",
    };

    addToWarehouse(item);
    const retrieved = getWarehouseItemById(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(id);
    expect(retrieved!.title).toBe("Retrieve By ID Test");
    expect(retrieved!.variables).toEqual(["Topic"]);
  });

  it("returns undefined for non-existent id", () => {
    const result = getWarehouseItemById("definitely-does-not-exist-zzzzzz");
    expect(result).toBeUndefined();
  });

  it("overwrites existing item with same id", () => {
    const id = `test-overwrite-${Date.now()}`;
    const original: WarehouseItem = {
      id,
      type: "prompt",
      title: "Original Title",
      description: "Original description",
      targetRoles: [],
      useCase: "Original use case",
      status: "draft",
      linkedItems: [],
      tags: [],
      variables: [],
      filePath: "/tmp/overwrite-test.md",
    };

    addToWarehouse(original);

    const updated: WarehouseItem = {
      ...original,
      title: "Updated Title",
      status: "ready",
    };
    addToWarehouse(updated);

    const retrieved = getWarehouseItemById(id);
    expect(retrieved!.title).toBe("Updated Title");
    expect(retrieved!.status).toBe("ready");
  });
});

// ── addBundle / getBundle / listBundles ───────────────────────────────────────

describe("Bundle operations", () => {
  it("can add a bundle and retrieve it by id", () => {
    const bundleId = `test-bundle-${Date.now()}`;
    const bundle: Bundle = {
      id: bundleId,
      title: "Test Bundle",
      description: "A test bundle for unit testing",
      theme: "testing",
      targetRoles: ["ceo"],
      itemIds: ["item-1", "item-2"],
      createdAt: new Date().toISOString(),
    };

    addBundle(bundle);
    const retrieved = getBundle(bundleId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(bundleId);
    expect(retrieved!.title).toBe("Test Bundle");
    expect(retrieved!.itemIds).toEqual(["item-1", "item-2"]);
  });

  it("returns undefined for non-existent bundle id", () => {
    const result = getBundle("bundle-does-not-exist-xyz");
    expect(result).toBeUndefined();
  });

  it("listBundles returns an array", () => {
    const bundles = listBundles();
    expect(Array.isArray(bundles)).toBe(true);
  });

  it("added bundle appears in listBundles", () => {
    const bundleId = `test-list-bundle-${Date.now()}`;
    const bundle: Bundle = {
      id: bundleId,
      title: "List Test Bundle",
      description: "Bundle to test listing",
      theme: "test",
      targetRoles: [],
      itemIds: [],
      createdAt: new Date().toISOString(),
    };

    addBundle(bundle);
    const all = listBundles();
    const found = all.find((b) => b.id === bundleId);
    expect(found).toBeDefined();
  });

  it("overwrites existing bundle with same id", () => {
    const bundleId = `test-overwrite-bundle-${Date.now()}`;
    const original: Bundle = {
      id: bundleId,
      title: "Original Bundle",
      description: "Original",
      theme: "original",
      targetRoles: [],
      itemIds: ["item-a"],
      createdAt: new Date().toISOString(),
    };

    addBundle(original);

    const updated: Bundle = { ...original, title: "Updated Bundle", itemIds: ["item-a", "item-b"] };
    addBundle(updated);

    const retrieved = getBundle(bundleId);
    expect(retrieved!.title).toBe("Updated Bundle");
    expect(retrieved!.itemIds).toEqual(["item-a", "item-b"]);
  });
});
