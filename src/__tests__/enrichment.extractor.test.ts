import { describe, it, expect } from "vitest";
import { enrichInput } from "../enrichment/extractor.js";

// ── Text enrichment ───────────────────────────────────────────────────────────

describe("enrichInput — text type", () => {
  it("extracts title from markdown heading", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "# My Business Strategy\n\nDetailed content here.",
    });
    expect(result.extractedTitle).toBe("My Business Strategy");
  });

  it("extracts title from bold first line", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "**Sales Mastery Guide**\n\nContent here.",
    });
    expect(result.extractedTitle).toBe("Sales Mastery Guide");
  });

  it("extracts title from first meaningful line", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Build a Marketing Funnel from Scratch\n\nContent here.",
    });
    expect(result.extractedTitle).toContain("Marketing Funnel");
  });

  it("returns fallback title when no heading found", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Hi",
    });
    expect(result.extractedTitle).toBe("Untitled text");
  });

  it("detects business topics in content", async () => {
    const result = await enrichInput({
      type: "text",
      payload:
        "This guide covers sales strategy, marketing campaigns, and revenue growth for your startup.",
    });
    expect(result.detectedTopics).toContain("sales");
    expect(result.detectedTopics).toContain("marketing");
    expect(result.detectedTopics).toContain("revenue");
    expect(result.detectedTopics).toContain("startup");
  });

  it("detects workflow as suggested asset type for step-heavy content", async () => {
    const result = await enrichInput({
      type: "text",
      payload:
        "Step 1: Research. Step 2: Plan. Step 3: Execute. Step 4: Review. Follow this workflow process.",
    });
    expect(result.suggestedAssetTypes).toContain("workflow");
  });

  it("suggests prompt for short content", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Write a sales pitch for my SaaS product.",
    });
    expect(result.suggestedAssetTypes).toContain("prompt");
  });

  it("detects project-template for startup/build content", async () => {
    const result = await enrichInput({
      type: "text",
      payload:
        "Build a startup product from scratch. Define the MVP, create the roadmap, and launch.",
    });
    expect(result.suggestedAssetTypes).toContain("project-template");
  });

  it("detects agent-config for AI agent content", async () => {
    const result = await enrichInput({
      type: "text",
      payload:
        "Create an AI assistant agent persona that acts as a sales bot with a custom role.",
    });
    expect(result.suggestedAssetTypes).toContain("agent-config");
  });

  it("extracts key entities including capitalized words", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Salesforce and HubSpot are popular CRM platforms used by enterprise companies.",
    });
    expect(result.keyEntities).toContain("Salesforce");
    expect(result.keyEntities).toContain("HubSpot");
  });

  it("extracts URLs from content", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Learn more at https://example.com/guide and https://docs.example.com",
    });
    expect(result.keyEntities).toContain("https://example.com/guide");
  });

  it("extracts numeric metrics", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Revenue grew by 150% to $2,500,000 in fiscal year 2024.",
    });
    const metricsFound = result.keyEntities.some(
      (e) => e.includes("150%") || e.includes("$2,500,000") || e.includes("2024")
    );
    expect(metricsFound).toBe(true);
  });

  it("reports correct word count", async () => {
    const payload = "one two three four five";
    const result = await enrichInput({ type: "text", payload });
    expect(result.wordCount).toBe(5);
  });

  it("returns language as 'en' for English content", async () => {
    const result = await enrichInput({ type: "text", payload: "Hello, this is English text." });
    expect(result.language).toBe("en");
  });

  it("detects French language heuristic", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Voici un texte français avec des caractères spéciaux comme à, â, ç.",
    });
    expect(result.language).toBe("fr");
  });

  it("appends user context when provided", async () => {
    const result = await enrichInput({
      type: "text",
      payload: "Basic content.",
      context: "This is for a B2B SaaS company",
    });
    expect(result.bodyText).toContain("B2B SaaS company");
  });

  it("preserves the rawInput reference", async () => {
    const input = { type: "text" as const, payload: "Test content" };
    const result = await enrichInput(input);
    expect(result.rawInput).toBe(input);
  });

  it("caps bodyText at 8000 characters", async () => {
    const payload = "x".repeat(10_000);
    const result = await enrichInput({ type: "text", payload });
    expect(result.bodyText.length).toBeLessThanOrEqual(8000);
  });
});

// ── File type ─────────────────────────────────────────────────────────────────

describe("enrichInput — file type", () => {
  it("treats file payload as text content", async () => {
    const result = await enrichInput({
      type: "file",
      payload: "# Product Roadmap\n\nBuild and launch the MVP.",
    });
    expect(result.extractedTitle).toBe("Product Roadmap");
    expect(result.detectedTopics.length).toBeGreaterThan(0);
  });
});

// ── Transcript type ───────────────────────────────────────────────────────────

describe("enrichInput — transcript type", () => {
  it("removes filler words from transcript", async () => {
    const result = await enrichInput({
      type: "transcript",
      payload:
        "Um, basically, like you know, I want to, um, build a sales strategy for my startup.",
    });
    expect(result.bodyText).not.toContain(" um ");
    expect(result.bodyText).not.toContain(" basically ");
    expect(result.bodyText).not.toContain(" like ");
  });

  it("retains meaningful content after filler removal", async () => {
    const result = await enrichInput({
      type: "transcript",
      payload: "Um, I want to improve sales conversion rates for my company.",
    });
    expect(result.bodyText).toContain("sales");
  });
});

// ── URL type (no real network — verify error is thrown for unreachable host) ──

describe("enrichInput — url type", () => {
  it("throws a meaningful error for an unreachable URL", async () => {
    // Use a local port that is almost certainly not listening to avoid real network
    await expect(
      enrichInput({
        type: "url",
        payload: "http://localhost:19999/nonexistent-path",
      })
    ).rejects.toThrow(Error);
  });
});
