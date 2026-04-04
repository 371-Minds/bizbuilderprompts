import { extname } from "path";
import { extractVariables } from "../utils/template.js";
import type {
  ClassificationResult,
  CategoryCandidate,
  FrameworkType,
  IngestionInput,
  CategoryInfo,
} from "./types.js";

// ── Category definitions with weighted keywords ───────────────────────────────

export const CATEGORY_DEFINITIONS: CategoryInfo[] = [
  {
    name: "sales",
    description: "Sales techniques, conversion copywriting, and persuasion prompts",
    keywords: [
      "close", "closing", "deal", "offer", "discount", "price", "negotiate",
      "negotiation", "conversion", "copywriter", "persuasion", "persuasive",
      "sales", "prospect", "pipeline", "revenue", "upsell", "funnel",
      "objection", "pitch", "buy", "purchase",
    ],
    dirPath: "sales",
  },
  {
    name: "marketing",
    description: "Marketing strategy, growth, brand, and audience prompts",
    keywords: [
      "campaign", "brand", "branding", "social media", "email", "ad",
      "ads", "advertising", "audience", "growth", "marketing", "awareness",
      "engagement", "content marketing", "seo", "influencer", "viral launch",
      "go-to-market", "demand generation",
    ],
    dirPath: "marketing",
  },
  {
    name: "video",
    description: "Video content, thumbnail, and script generation prompts",
    keywords: [
      "video", "thumbnail", "youtube", "short", "reel", "tiktok",
      "script", "storyboard", "b-roll", "hook", "vlog", "footage",
      "screencast", "explainer",
    ],
    dirPath: "video_prompts",
  },
  {
    name: "image-prompt",
    description: "AI image and video generation prompts (product visuals, Veo)",
    keywords: [
      "image", "visual", "photo", "photograph", "render", "veo",
      "product shot", "product image", "generate image", "stable diffusion",
      "midjourney", "dall-e", "diffusion", "generative", "art style",
      "illustration", "cinematic",
    ],
    dirPath: "image_prompts/veo/prompts",
  },
  {
    name: "project",
    description: "Startup and project idea blueprints and templates",
    keywords: [
      "startup", "idea", "build", "develop", "roadmap", "product",
      "mvp", "prototype", "feature", "user story", "backlog",
      "sprint", "project", "blueprint", "spec", "requirements",
      "architecture", "technical", "engineering",
    ],
    dirPath: "projects",
  },
  {
    name: "promotion",
    description: "Promotional copy, ad copy, email hooks, and marketing examples",
    keywords: [
      "promotion", "promotional", "promo", "ad copy", "coupon",
      "limited time", "free offer", "announcement", "launch offer",
      "special", "exclusive deal", "flash sale", "giveaway",
    ],
    dirPath: "promotion_prompts_examples",
  },
  {
    name: "business_strategy",
    description: "Business strategy, optimization, transformation, and improvement prompts",
    keywords: [
      "kaizen", "mastermind", "alchemist", "business",
      "strategy", "optimization", "improvement", "efficiency",
      "transformation", "growth strategy", "competitive", "market",
      "enterprise", "organization", "operations", "process improvement",
      "value proposition", "business model",
    ],
    dirPath: "business_strategy",
  },
  {
    name: "customer_success",
    description: "Onboarding, support, customer success, and retention prompts",
    keywords: [
      "onboard", "onboarding", "support", "help desk", "tutorial",
      "guide", "resolve", "customer success", "retention", "churn",
      "satisfaction", "nps", "feedback", "engagement", "lifecycle",
      "customer journey",
    ],
    dirPath: "customer_success",
  },
  {
    name: "workflow",
    description: "Multi-step business workflow frameworks and processes",
    keywords: [
      "phase 1", "phase 2", "phase 3", "step 1", "step 2", "step 3",
      "discover", "space", "flow", "workflow", "playbook",
      "orchestration", "master prompt", "multi-step", "lifecycle",
    ],
    dirPath: "",
  },
  {
    name: "general",
    description: "General-purpose business prompts that don't fit other categories",
    keywords: [],
    dirPath: "",
  },
];

// ── Scoring helpers ───────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreContent(text: string, keywords: string[], weight: number): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`, "gi");
    const matches = lower.match(pattern);
    if (matches) {
      score += matches.length * weight;
    }
  }
  return score;
}

// ── Framework detection ───────────────────────────────────────────────────────

function detectFramework(content: string): FrameworkType {
  const lower = content.toLowerCase();

  if (
    /discover.*space.*flow/s.test(lower) ||
    /phase\s+1.*discover/i.test(lower) ||
    /dsf\s+playbook/i.test(lower)
  ) {
    return "dsf";
  }

  if (
    /\brcrc\b/.test(lower) ||
    /root.to.rise/i.test(lower) ||
    /\br2r\b/.test(lower)
  ) {
    return "rcrc";
  }

  if (
    /\bkaizen\b/.test(lower) ||
    /continuous improvement/i.test(lower) ||
    /micro.improvement/i.test(lower)
  ) {
    return "kaizen";
  }

  if (
    /\balchemist\b/.test(lower) ||
    /transmut/i.test(lower)
  ) {
    return "alchemist";
  }

  if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    return "structured";
  }

  if (/^(SYSTEM|system):/m.test(content) || /^(USER|user):/m.test(content)) {
    return "system-user";
  }

  if (/\{\{[^}]+\}\}/.test(content)) {
    return "template";
  }

  return "unknown";
}

// ── Workflow content detection ────────────────────────────────────────────────

function isWorkflowContent(content: string, filename?: string): boolean {
  const lower = content.toLowerCase();
  const name = (filename ?? "").toLowerCase();

  const hasMultiPhase =
    /phase\s+[123]/i.test(content) ||
    /(discover|space|flow)\s+phase/i.test(content);

  const hasStepSequence =
    /step\s+\d+\.\d+/i.test(content) ||
    (/step\s+1/i.test(content) && /step\s+2/i.test(content));

  const hasMasterPrompt =
    lower.includes("master prompt") || name.includes("master");

  const hasWorkflowKeywords =
    (lower.includes("workflow") || lower.includes("playbook")) &&
    hasStepSequence;

  return hasMultiPhase || hasMasterPrompt || hasWorkflowKeywords;
}

// ── Filename suggestion ───────────────────────────────────────────────────────

function suggestFilename(input: IngestionInput, category: string): string {
  if (input.filename) {
    const ext = extname(input.filename);
    return ext ? input.filename : `${input.filename}.md`;
  }

  if (input.title) {
    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_")
      .slice(0, 60);
    return `${slug}.md`;
  }

  const firstLine = input.content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 3);

  if (firstLine) {
    const slug = firstLine
      .replace(/^#+\s*/, "")
      .replace(/^[<{]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50);
    if (slug.length > 3) {
      return `${slug}.md`;
    }
  }

  return `${category}_prompt_${Date.now()}.md`;
}

// ── Main classify function ────────────────────────────────────────────────────

export function classify(input: IngestionInput): ClassificationResult {
  const { content, filename, title, type } = input;

  const titleText = [filename ?? "", title ?? ""].join(" ");
  const firstParagraph = content.slice(0, 300);
  const bodyText = content.slice(300, 2000);
  const detectedVariables = extractVariables(content);
  const frameworkType = detectFramework(content);

  if (type === "workflow" || isWorkflowContent(content, filename)) {
    return buildResult(
      "workflow",
      1.0,
      [{ category: "workflow", score: 100 }],
      input,
      frameworkType,
      detectedVariables,
      "Content matches multi-step workflow pattern"
    );
  }

  const candidates: CategoryCandidate[] = [];

  for (const catDef of CATEGORY_DEFINITIONS) {
    if (catDef.name === "general" || catDef.name === "workflow") continue;

    const score =
      scoreContent(titleText, catDef.keywords, 3) +
      scoreContent(firstParagraph, catDef.keywords, 2) +
      scoreContent(bodyText, catDef.keywords, 1);

    if (score > 0) {
      candidates.push({ category: catDef.name, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  let bestCategory = "general";
  let confidence = 0.3;
  let reasoning = "No strong category signals detected; defaulting to general";

  if (candidates.length > 0) {
    const top = candidates[0];
    const second = candidates[1];

    bestCategory = top.category;

    if (second) {
      confidence = Math.min(0.95, top.score / (top.score + second.score));
    } else {
      confidence = Math.min(0.95, 0.5 + top.score / 20);
    }

    const catDef = CATEGORY_DEFINITIONS.find((c) => c.name === bestCategory);
    reasoning =
      `Matched "${bestCategory}" with score ${top.score}` +
      (second ? ` (runner-up: "${second.category}" score ${second.score})` : "") +
      `. Top keywords: ${catDef?.keywords.slice(0, 3).join(", ")}`;
  }

  if (type === "framework" && frameworkType !== "unknown") {
    reasoning = `Framework type: ${frameworkType}. ${reasoning}`;
  }

  return buildResult(
    bestCategory,
    confidence,
    candidates,
    input,
    frameworkType,
    detectedVariables,
    reasoning
  );
}

function buildResult(
  category: string,
  confidence: number,
  candidates: CategoryCandidate[],
  input: IngestionInput,
  frameworkType: FrameworkType,
  detectedVariables: string[],
  reasoning: string
): ClassificationResult {
  const catDef = CATEGORY_DEFINITIONS.find((c) => c.name === category);
  const tagSet = new Set<string>(catDef?.keywords.slice(0, 3) ?? []);

  const contentLower = input.content.toLowerCase();
  const tagKeywords = [
    "ai", "automation", "business", "strategy", "growth", "sales",
    "marketing", "content", "template", "framework", "workflow",
    "startup", "coaching", "legal", "finance", "copywriting",
  ];
  for (const kw of tagKeywords) {
    if (contentLower.includes(kw)) tagSet.add(kw);
  }

  return {
    category,
    confidence,
    candidates: candidates.slice(0, 3),
    tags: Array.from(tagSet).slice(0, 8),
    detectedVariables,
    frameworkType,
    suggestedFilename: suggestFilename(input, category),
    reasoning,
  };
}
