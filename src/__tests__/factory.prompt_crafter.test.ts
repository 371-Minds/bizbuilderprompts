import { describe, it, expect } from "vitest";
import { craftPrompt } from "../factory/prompt_crafter.js";
import type { AssetSpec } from "../factory/types.js";

function makeSpec(overrides: Partial<AssetSpec> = {}): AssetSpec {
  return {
    type: "prompt",
    topic: "Sales Strategy",
    goal: "Increase conversion rates by 20%",
    ...overrides,
  };
}

describe("craftPrompt — basic output", () => {
  it("returns a draft with content, filename, category, and variables", () => {
    const draft = craftPrompt(makeSpec());
    expect(typeof draft.content).toBe("string");
    expect(draft.content.length).toBeGreaterThan(100);
    expect(typeof draft.suggestedFilename).toBe("string");
    expect(draft.suggestedFilename).toMatch(/\.md$/);
    expect(typeof draft.suggestedCategory).toBe("string");
    expect(Array.isArray(draft.variables)).toBe(true);
  });

  it("includes the topic in the content", () => {
    const draft = craftPrompt(makeSpec({ topic: "Customer Retention" }));
    expect(draft.content).toContain("Customer Retention");
  });

  it("includes the goal in the content", () => {
    const draft = craftPrompt(makeSpec({ goal: "Reduce churn by 15%" }));
    expect(draft.content).toContain("Reduce churn by 15%");
  });

  it("generates a slugified filename from topic", () => {
    const draft = craftPrompt(makeSpec({ topic: "Email Marketing Strategy!" }));
    expect(draft.suggestedFilename).toBe("email-marketing-strategy.md");
  });

  it("handles special characters in topic for filename", () => {
    const draft = craftPrompt(makeSpec({ topic: "Sales & Growth (2024)" }));
    expect(draft.suggestedFilename).not.toContain("&");
    expect(draft.suggestedFilename).not.toContain("(");
    expect(draft.suggestedFilename).toMatch(/\.md$/);
  });

  it("marks estimatedQuality as high when 2+ variables present", () => {
    // The prompt crafter always adds {{Topic}}, {{Goal}}, etc.
    const draft = craftPrompt(makeSpec());
    // Standard prompts have multiple {{Variables}}
    expect(draft.estimatedQuality).toBe("high");
  });

  it("includes spec reference in draft", () => {
    const spec = makeSpec({ topic: "Legal Compliance" });
    const draft = craftPrompt(spec);
    expect(draft.spec).toBe(spec);
  });
});

describe("craftPrompt — category inference", () => {
  it("infers 'sales' category for sales-related topic", () => {
    const draft = craftPrompt(makeSpec({ topic: "Sales Closing Techniques" }));
    expect(draft.suggestedCategory).toBe("sales");
  });

  it("infers 'marketing' category for marketing topic", () => {
    const draft = craftPrompt(makeSpec({ topic: "Marketing Campaign Strategy" }));
    expect(draft.suggestedCategory).toBe("marketing");
  });

  it("infers 'project' category for product/startup topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Startup Product Roadmap" }));
    expect(draft.suggestedCategory).toBe("project");
  });

  it("infers 'image-prompt' category for visual topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Product Image Visual Design" }));
    expect(draft.suggestedCategory).toBe("image-prompt");
  });

  it("falls back to 'general' for uncategorized topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Miscellaneous Business Help" }));
    expect(draft.suggestedCategory).toBe("general");
  });

  it("uses goal for category inference when topic is ambiguous", () => {
    const draft = craftPrompt(
      makeSpec({ topic: "Business Plan", goal: "Drive go-to-market strategy launch" })
    );
    expect(draft.suggestedCategory).toBe("marketing");
  });
});

describe("craftPrompt — role section", () => {
  it("uses sales role description for sales topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Sales Conversion" }));
    expect(draft.content).toContain("sales strategist");
  });

  it("uses marketing role description for marketing topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Brand Marketing Campaign" }));
    expect(draft.content).toContain("marketing expert");
  });

  it("uses legal role description for legal topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Legal Compliance Audit" }));
    expect(draft.content).toContain("attorney");
  });

  it("uses finance role description for finance topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Financial Tax Strategy" }));
    expect(draft.content).toContain("CFO");
  });

  it("uses product role description for product topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Product Roadmap Feature Planning" }));
    expect(draft.content).toContain("product leader");
  });

  it("uses engineering role for tech/AI topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "AI Automation Engineering" }));
    expect(draft.content).toContain("architect");
  });

  it("uses copywriting role for content/copy topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Content Copywriting Strategy" }));
    expect(draft.content).toContain("copywriter");
  });

  it("uses strategy role for growth/venture topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Business Growth Strategy" }));
    expect(draft.content).toContain("strategic");
  });

  it("defaults to 'world-class business consultant' for unrecognized topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "General Advice" }));
    expect(draft.content).toContain("world-class business consultant");
  });
});

describe("craftPrompt — framework handling", () => {
  it("includes framework label in content when framework specified", () => {
    const draft = craftPrompt(makeSpec({ framework: "kaizen" }));
    expect(draft.content).toContain("KAIZEN");
  });

  it("includes DSF framework note in content", () => {
    const draft = craftPrompt(makeSpec({ framework: "dsf" }));
    expect(draft.content).toContain("DSF");
  });

  it("includes RCRC framework note in content", () => {
    const draft = craftPrompt(makeSpec({ framework: "rcrc" }));
    expect(draft.content).toContain("RCRC");
  });

  it("includes Alchemist framework note in content", () => {
    const draft = craftPrompt(makeSpec({ framework: "alchemist" }));
    expect(draft.content).toContain("ALCHEMIST");
  });

  it("does not fail when no framework specified", () => {
    expect(() => craftPrompt(makeSpec())).not.toThrow();
  });
});

describe("craftPrompt — optional fields", () => {
  it("uses provided audience in content", () => {
    const draft = craftPrompt(makeSpec({ audience: "enterprise CFOs" }));
    expect(draft.content).toContain("enterprise CFOs");
  });

  it("defaults audience to 'business professionals' when not specified", () => {
    const draft = craftPrompt(makeSpec());
    expect(draft.content).toContain("business professionals");
  });

  it("includes style in content when provided", () => {
    const draft = craftPrompt(makeSpec({ style: "bold and persuasive" }));
    expect(draft.content).toContain("bold and persuasive");
  });

  it("includes context variable placeholder when no context provided", () => {
    const draft = craftPrompt(makeSpec());
    expect(draft.content).toContain("{{Business Context}}");
  });

  it("uses {{Context}} placeholder when context is provided", () => {
    const draft = craftPrompt(makeSpec({ context: "B2B SaaS startup" }));
    expect(draft.content).toContain("{{Context}}");
  });
});

describe("craftPrompt — output sections", () => {
  it("includes output format section", () => {
    const draft = craftPrompt(makeSpec());
    expect(draft.content).toContain("## Output Format");
  });

  it("includes sales-specific output sections for sales topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Sales Closing Techniques" }));
    expect(draft.content).toContain("Scripts & Templates");
  });

  it("includes marketing-specific sections for marketing topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Marketing Campaign Launch" }));
    expect(draft.content).toContain("Channel Breakdown");
  });

  it("includes legal-specific sections for legal topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Legal Compliance Audit" }));
    expect(draft.content).toContain("Risk Assessment");
  });

  it("includes product-specific sections for product topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Product Roadmap" }));
    expect(draft.content).toContain("Prioritization Matrix");
  });

  it("includes finance-specific sections for finance topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "Financial Tax Strategy" }));
    expect(draft.content).toContain("Risk Factors");
  });

  it("includes default sections for generic topics", () => {
    const draft = craftPrompt(makeSpec({ topic: "General Business Help" }));
    expect(draft.content).toContain("Executive Summary");
    expect(draft.content).toContain("Action Plan");
  });
});
