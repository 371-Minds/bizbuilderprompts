import type { RawInput, EnrichedInput } from "./types.js";

const BUSINESS_TOPICS = [
  "sales", "marketing", "revenue", "growth", "brand", "campaign", "conversion",
  "product", "roadmap", "strategy", "launch", "go-to-market", "pricing",
  "customer", "audience", "segment", "persona", "retention", "churn",
  "legal", "compliance", "contract", "ip", "patent", "trademark", "gdpr",
  "finance", "tax", "investment", "budget", "forecast", "cashflow",
  "operations", "process", "sop", "workflow", "automation", "efficiency",
  "engineering", "architecture", "api", "integration", "infrastructure",
  "content", "copywriting", "email", "social", "seo", "ads", "influencer",
  "startup", "venture", "funding", "investor", "pitch", "mvp", "validation",
  "team", "hiring", "onboarding", "culture", "leadership", "management",
  "ai", "machine learning", "data", "analytics", "dashboard", "kpi",
];

const ASSET_TYPE_INDICATORS: Array<{ keywords: string[]; assetType: string }> = [
  { keywords: ["step", "workflow", "process", "phase", "stage", "sequence", "pipeline"], assetType: "workflow" },
  { keywords: ["image", "visual", "video", "photo", "render", "graphic", "brand asset"], assetType: "image-spec" },
  { keywords: ["strategy", "plan", "framework", "playbook", "guide", "system"], assetType: "prompt" },
  { keywords: ["template", "script", "copy", "email", "message", "pitch"], assetType: "prompt" },
  { keywords: ["project", "startup", "app", "platform", "product", "build"], assetType: "project-template" },
  { keywords: ["agent", "assistant", "bot", "persona", "role", "ai model"], assetType: "agent-config" },
];

function detectLanguage(text: string): string {
  // Simple heuristic — check for common non-English characters
  if (/[àáâãäåæç]/i.test(text)) return "fr";
  if (/[ñ]/i.test(text)) return "es";
  if (/[ü]/i.test(text)) return "de";
  return "en";
}

function extractTitle(text: string, inputType: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Look for markdown headings
  const heading = lines.find((l) => l.startsWith("#"));
  if (heading) return heading.replace(/^#+\s*/, "").trim();

  // Look for bold or all-caps first line
  const first = lines[0] ?? "";
  if (first.length < 100 && (/^\*\*.*\*\*$/.test(first) || first === first.toUpperCase())) {
    return first.replace(/\*\*/g, "").trim();
  }

  // Fallback: use first non-trivial line
  const meaningfulLine = lines.find((l) => l.length > 10 && l.length < 120);
  if (meaningfulLine) return meaningfulLine.slice(0, 80);

  return `Untitled ${inputType}`;
}

function detectTopics(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];
  for (const topic of BUSINESS_TOPICS) {
    if (lowerText.includes(topic) && found.length < 10) {
      found.push(topic);
    }
  }
  return found;
}

function suggestAssetTypes(text: string, detectedTopics: string[]): string[] {
  const lowerText = text.toLowerCase();
  const suggested = new Set<string>();

  for (const { keywords, assetType } of ASSET_TYPE_INDICATORS) {
    if (keywords.some((k) => lowerText.includes(k))) {
      suggested.add(assetType);
    }
  }

  // If multi-step content is detected, suggest workflow
  const stepCount = (text.match(/\bstep\s+\d+|\b\d+\.\s/gi) ?? []).length;
  if (stepCount >= 3) suggested.add("workflow");

  // If very short (<500 chars), likely a prompt
  if (text.length < 500) suggested.add("prompt");

  // If it's a URL about a business, suggest prompt + workflow
  if (detectedTopics.length >= 3) suggested.add("prompt");

  return Array.from(suggested).slice(0, 4);
}

function extractKeyEntities(text: string): string[] {
  const entities: string[] = [];

  // URLs
  const urls = text.match(/https?:\/\/[^\s]+/g) ?? [];
  entities.push(...urls.slice(0, 3));

  // Capitalized terms (potential names, brands, products)
  const capitalWords = text.match(/\b[A-Z][a-zA-Z]{2,}\b/g) ?? [];
  const uniqueCaps = [...new Set(capitalWords)].filter(
    (w) => !["The", "This", "That", "With", "From", "Your", "You", "We", "Our", "Have", "Will", "When", "What", "How", "Are", "Can", "Should"].includes(w)
  );
  entities.push(...uniqueCaps.slice(0, 5));

  // Numbers that look like metrics or dates
  const metrics = text.match(/\$[\d,]+|\d+%|\d{4}/g) ?? [];
  entities.push(...metrics.slice(0, 3));

  return [...new Set(entities)].slice(0, 10);
}

async function fetchUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "BizBuilderPrompts/1.0 (+content-extractor)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    return stripHtml(html);
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${String(err)}`);
  }
}

function stripHtml(html: string): string {
  // Remove scripts, styles, and comments
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();

  // Limit to first 5000 chars for efficiency
  return text.slice(0, 5000);
}

function segmentIdeas(text: string): string {
  // For voice memos / transcripts: remove filler words and clean up
  const fillers = /\b(um|uh|like|you know|basically|literally|kind of|sort of|right|okay|so|well)\b/gi;
  const cleaned = text.replace(fillers, "").replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

/**
 * Extract and enrich raw input of any type.
 * Returns structured EnrichedInput with topics, suggested asset types, and key entities.
 */
export async function enrichInput(input: RawInput): Promise<EnrichedInput> {
  let bodyText = "";

  switch (input.type) {
    case "url": {
      bodyText = await fetchUrl(input.payload);
      break;
    }
    case "file": {
      // For MCP usage, file content is passed as the payload string
      bodyText = input.payload;
      break;
    }
    case "transcript": {
      bodyText = segmentIdeas(input.payload);
      break;
    }
    case "text":
    default: {
      bodyText = input.payload;
      break;
    }
  }

  // Append any user-provided context
  if (input.context) {
    bodyText = `${bodyText}\n\n[User Context: ${input.context}]`;
  }

  const extractedTitle = extractTitle(bodyText, input.type);
  const detectedTopics = detectTopics(bodyText);
  const suggestedAssetTypes = suggestAssetTypes(bodyText, detectedTopics);
  const keyEntities = extractKeyEntities(bodyText);
  const language = detectLanguage(bodyText);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  return {
    rawInput: input,
    extractedTitle,
    bodyText: bodyText.slice(0, 8000), // cap body text returned
    detectedTopics,
    suggestedAssetTypes,
    keyEntities,
    wordCount,
    language,
  };
}
