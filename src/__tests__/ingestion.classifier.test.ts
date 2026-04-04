import { describe, it, expect } from "vitest";
import { classify, CATEGORY_DEFINITIONS } from "../ingestion/classifier.js";

describe("CATEGORY_DEFINITIONS", () => {
  it("contains at least 10 categories", () => {
    expect(CATEGORY_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("always includes a 'general' fallback category", () => {
    const general = CATEGORY_DEFINITIONS.find((c) => c.name === "general");
    expect(general).toBeDefined();
  });

  it("always includes a 'workflow' category", () => {
    const workflow = CATEGORY_DEFINITIONS.find((c) => c.name === "workflow");
    expect(workflow).toBeDefined();
  });

  it("each category has required fields", () => {
    for (const cat of CATEGORY_DEFINITIONS) {
      expect(typeof cat.name).toBe("string");
      expect(typeof cat.description).toBe("string");
      expect(Array.isArray(cat.keywords)).toBe(true);
      expect(typeof cat.dirPath).toBe("string");
    }
  });
});

describe("classify — category detection", () => {
  it("classifies sales content correctly", () => {
    const result = classify({
      content:
        "Close the deal with powerful sales conversion techniques. Overcome objections, negotiate pricing, and improve your closing rate. Increase revenue from your sales pipeline.",
    });
    expect(result.category).toBe("sales");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("classifies marketing content correctly", () => {
    const result = classify({
      content:
        "Build a viral marketing campaign for brand awareness. Use social media advertising, email marketing, and influencer partnerships to grow your audience and increase engagement.",
    });
    expect(result.category).toBe("marketing");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("classifies video content correctly", () => {
    const result = classify({
      content:
        "Create engaging YouTube video thumbnails and scripts. Write storyboards for TikTok reels and YouTube shorts with compelling hooks.",
    });
    expect(result.category).toBe("video");
  });

  it("classifies image prompt content correctly", () => {
    const result = classify({
      content:
        "Generate a cinematic product image using Midjourney. Create a photorealistic render with stable diffusion art style for this product shot.",
    });
    expect(result.category).toBe("image-prompt");
  });

  it("classifies project/startup content correctly", () => {
    const result = classify({
      content:
        "Build an MVP for a startup SaaS product. Define the backlog, user stories, and product roadmap from prototype to launch.",
    });
    expect(result.category).toBe("project");
  });

  it("classifies promotion content correctly", () => {
    const result = classify({
      content:
        "Create promotional ad copy for a limited time flash sale. Write exclusive deal announcement with a compelling giveaway offer.",
    });
    expect(result.category).toBe("promotion");
  });

  it("classifies customer success content correctly", () => {
    const result = classify({
      content:
        "Design an onboarding experience to reduce churn and improve customer retention. Build a customer success lifecycle with NPS and satisfaction tracking.",
    });
    expect(result.category).toBe("customer_success");
  });

  it("falls back to 'general' for unclassifiable content", () => {
    const result = classify({
      content: "Hello. Please help me with this. Thank you.",
    });
    expect(result.category).toBe("general");
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it("respects explicit type='workflow' override", () => {
    const result = classify({
      content: "Just some random text",
      type: "workflow",
    });
    expect(result.category).toBe("workflow");
    expect(result.confidence).toBe(1.0);
  });
});

describe("classify — workflow detection", () => {
  it("detects multi-phase workflow content", () => {
    const result = classify({
      content: `
# Business Strategy Workflow

## Phase 1: Discover
Analyze the market landscape.

## Phase 2: Plan
Develop the strategy.

## Phase 3: Execute
Implement the plan.
      `,
    });
    expect(result.category).toBe("workflow");
  });

  it("detects DSF pattern (Discover/Space/Flow)", () => {
    const result = classify({
      content: `
# DSF Playbook

## Discover Phase
Research and explore.

## Space Phase
Create room for strategy.

## Flow Phase
Execute with momentum.
      `,
    });
    expect(result.category).toBe("workflow");
    expect(result.frameworkType).toBe("dsf");
  });

  it("detects RCRC framework", () => {
    const result = classify({
      content: "This prompt follows the RCRC root-to-rise methodology. r2r framework applied here.",
    });
    expect(result.frameworkType).toBe("rcrc");
  });

  it("detects Kaizen framework", () => {
    const result = classify({
      content: "Apply kaizen principles for continuous improvement and micro-improvement cycles.",
    });
    expect(result.frameworkType).toBe("kaizen");
  });

  it("detects Alchemist framework", () => {
    const result = classify({
      content: "The alchemist approach transmutes raw knowledge into business gold.",
    });
    expect(result.frameworkType).toBe("alchemist");
  });

  it("detects structured JSON format", () => {
    const result = classify({ content: '{"type": "prompt", "category": "sales"}' });
    expect(result.frameworkType).toBe("structured");
  });

  it("detects system-user prompt format", () => {
    const result = classify({
      content: "SYSTEM: You are a helpful assistant.\nUSER: Help me with sales.",
    });
    expect(result.frameworkType).toBe("system-user");
  });

  it("detects template format from {{Variable}} presence", () => {
    const result = classify({
      content:
        "You are helping {{Company Name}} achieve {{Business Goal}} by applying best practices.",
    });
    expect(result.frameworkType).toBe("template");
  });

  it("marks unknown for plain prose without framework signals", () => {
    const result = classify({
      content: "Write a short description of your product and its key benefits.",
    });
    expect(result.frameworkType).toBe("unknown");
  });
});

describe("classify — variable detection", () => {
  it("extracts template variables from content", () => {
    const result = classify({
      content:
        "Help {{Company Name}} create a {{Product Type}} for {{Target Audience}}.",
    });
    expect(result.detectedVariables).toContain("Company Name");
    expect(result.detectedVariables).toContain("Product Type");
    expect(result.detectedVariables).toContain("Target Audience");
  });

  it("returns empty variables for content without placeholders", () => {
    const result = classify({ content: "Plain content with no variables." });
    expect(result.detectedVariables).toEqual([]);
  });
});

describe("classify — filename suggestion", () => {
  it("uses provided filename if given", () => {
    const result = classify({
      content: "Sales techniques",
      filename: "my_sales_prompt.md",
    });
    expect(result.suggestedFilename).toBe("my_sales_prompt.md");
  });

  it("adds .md extension if filename has no extension", () => {
    const result = classify({
      content: "Sales techniques",
      filename: "my_sales_prompt",
    });
    expect(result.suggestedFilename).toBe("my_sales_prompt.md");
  });

  it("uses title to generate filename when no filename given", () => {
    const result = classify({
      content: "Marketing strategy content",
      title: "My Marketing Guide",
    });
    expect(result.suggestedFilename).toContain("my_marketing_guide");
    expect(result.suggestedFilename).toMatch(/\.md$/);
  });

  it("derives filename from content first line when no filename or title given", () => {
    const result = classify({
      content: "Great Sales Closing Techniques\n\nDetailed content here.",
    });
    expect(result.suggestedFilename).toMatch(/\.md$/);
    expect(result.suggestedFilename.length).toBeGreaterThan(4);
  });

  it("falls back to category-based name when content has no usable first line", () => {
    const result = classify({ content: "Hi" });
    expect(result.suggestedFilename).toMatch(/\.md$/);
  });
});

describe("classify — candidates and reasoning", () => {
  it("returns candidates array with scores", () => {
    const result = classify({
      content:
        "Sales conversion strategy for marketing campaigns. Improve sales pipeline and marketing brand.",
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(typeof c.category).toBe("string");
      expect(typeof c.score).toBe("number");
    }
  });

  it("returns a non-empty reasoning string", () => {
    const result = classify({ content: "Sales techniques for closing deals." });
    expect(typeof result.reasoning).toBe("string");
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it("reasoning mentions category match for confident result", () => {
    const result = classify({
      content: "Boost your sales pipeline with closing strategies. Close deals, convert leads.",
    });
    expect(result.reasoning).toContain("sales");
  });
});
