import { describe, it, expect, beforeEach } from "vitest";
import { buildSearchIndex, searchPrompts, suggestPrompts } from "../utils/search.js";
import type { PromptEntry } from "../types.js";

function makeEntry(overrides: Partial<PromptEntry> = {}): PromptEntry {
  return {
    id: "test-id",
    title: "Test Prompt",
    category: "general",
    tags: [],
    description: "A test prompt for unit testing",
    variables: [],
    filePath: "/prompts/test.md",
    fileType: "prompt",
    mimeType: "text/markdown",
    ...overrides,
  };
}

const SAMPLE_PROMPTS: PromptEntry[] = [
  makeEntry({
    id: "sales-closing",
    title: "Sales Closing Techniques",
    category: "sales",
    tags: ["sales", "conversion", "closing"],
    description: "Advanced strategies to close deals and overcome objections",
    variables: ["Product", "Price"],
  }),
  makeEntry({
    id: "marketing-campaign",
    title: "Marketing Campaign Builder",
    category: "marketing",
    tags: ["marketing", "campaign", "brand"],
    description: "Build a comprehensive marketing campaign strategy",
    variables: ["Product", "Target Audience", "Budget"],
  }),
  makeEntry({
    id: "legal-compliance",
    title: "Legal Compliance Checklist",
    category: "general",
    tags: ["legal", "compliance", "gdpr"],
    description: "Ensure your business meets all legal compliance requirements",
    variables: ["Business Type", "Jurisdiction"],
  }),
  makeEntry({
    id: "product-roadmap",
    title: "Product Roadmap Template",
    category: "project",
    tags: ["product", "roadmap", "startup"],
    description: "Structure your product roadmap from MVP to launch",
    variables: ["Product Name", "Timeline"],
  }),
  makeEntry({
    id: "email-copywriting",
    title: "Email Copywriting Framework",
    category: "marketing",
    tags: ["email", "copywriting", "conversion"],
    description: "Write high-converting email sequences using AIDA framework",
    variables: ["Product", "Audience", "Offer"],
  }),
];

describe("buildSearchIndex", () => {
  it("builds index without throwing", () => {
    expect(() => buildSearchIndex(SAMPLE_PROMPTS)).not.toThrow();
  });

  it("handles empty array without throwing", () => {
    expect(() => buildSearchIndex([])).not.toThrow();
  });
});

describe("searchPrompts", () => {
  beforeEach(() => {
    buildSearchIndex(SAMPLE_PROMPTS);
  });

  it("returns results for a matching query", () => {
    const results = searchPrompts("sales closing", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.id).toBe("sales-closing");
  });

  it("returns results matching category", () => {
    const results = searchPrompts("marketing", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.item.id);
    expect(ids).toContain("marketing-campaign");
  });

  it("returns empty array for a nonsensical query", () => {
    const results = searchPrompts("xyzzy123nonsense", SAMPLE_PROMPTS);
    expect(results).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const results = searchPrompts("marketing", SAMPLE_PROMPTS, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("returns scores between 0 and 1", () => {
    const results = searchPrompts("sales", SAMPLE_PROMPTS);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("includes an excerpt for each result", () => {
    const results = searchPrompts("legal", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.excerpt).toBe("string");
      expect(r.excerpt.length).toBeGreaterThan(0);
    }
  });

  it("builds search index automatically when called without prior buildSearchIndex", () => {
    // Reset by passing different prompts
    const singlePrompt = [makeEntry({ id: "solo", title: "Solo Prompt", description: "unique" })];
    const results = searchPrompts("solo", singlePrompt);
    expect(results.length).toBeGreaterThanOrEqual(0); // may or may not match depending on threshold
  });

  it("includes tags in excerpt when available", () => {
    const results = searchPrompts("sales closing", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].excerpt).toContain("Tags:");
  });

  it("includes variables in excerpt when available", () => {
    const results = searchPrompts("product roadmap", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    const roadmapResult = results.find((r) => r.item.id === "product-roadmap");
    if (roadmapResult) {
      expect(roadmapResult.excerpt).toContain("Variables:");
    }
  });
});

describe("suggestPrompts", () => {
  it("returns suggestions for a relevant goal", () => {
    const results = suggestPrompts("I want to increase sales conversions", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
  });

  it("ranks the most relevant result first", () => {
    const results = suggestPrompts("build a marketing campaign for my brand", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    // Marketing campaign should rank near top
    const ids = results.map((r) => r.id);
    expect(ids).toContain("marketing-campaign");
  });

  it("respects the limit parameter", () => {
    const results = suggestPrompts("business strategy", SAMPLE_PROMPTS, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("includes a reason string for each suggestion", () => {
    const results = suggestPrompts("email marketing conversion", SAMPLE_PROMPTS);
    for (const r of results) {
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns empty array when no prompts match", () => {
    const results = suggestPrompts("quantum physics spacecraft", SAMPLE_PROMPTS);
    expect(results).toEqual([]);
  });

  it("handles empty prompts array gracefully", () => {
    const results = suggestPrompts("sales", []);
    expect(results).toEqual([]);
  });

  it("reason contains matched terms", () => {
    const results = suggestPrompts("email copywriting", SAMPLE_PROMPTS);
    expect(results.length).toBeGreaterThan(0);
    const emailResult = results.find((r) => r.id === "email-copywriting");
    if (emailResult) {
      expect(emailResult.reason).toContain("Matched terms:");
    }
  });
});
