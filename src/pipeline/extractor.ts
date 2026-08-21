/**
 * Methodology extractor — the IP of the pipeline.
 *
 * Two responsibilities:
 *   1. Build + send the extraction prompt to the router, parse the JSON response.
 *   2. Pre-score each extracted item's fidelity against its sourceQuote.
 *
 * The contract is strict: extracted assets must be CONCRETE and immediately usable
 * (never `{{variable}}` scaffolds — the factory's crafters already do that job).
 * Each item carries a verbatim `sourceQuote` so any reviewer can verify the claim
 * against the source (identified by `provenance.sourceHash`).
 */

import { callRouter, sha256, FALLBACK_MARKER } from "./router-client.js";
import type { ExtractedAsset, ExtractionResult, PipelineFramework } from "./types.js";

/** Items scoring below this are flagged for mandatory C-Suite review. */
const REVIEW_THRESHOLD = 0.6;

/** Max items extracted from one source. Keeps extraction cheap and focused. */
const DEFAULT_MAX_ITEMS = 8;

/**
 * The extraction system prompt — the contract between us and the model.
 * Exported so tests can assert it forbids templated output.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a methodology and decision-framework extractor for the BizBuilder asset warehouse.

Your job: read a source document and extract REUSABLE METHODOLOGIES, DECISION FRAMEWORKS, and WORKING PROCESSES — the repeatable logic an operator could apply to a different situation.

STRICT RULES:
1. Extract METHODS, not people. Never produce a persona, biography, or "act like this person" prompt. No names in the content except where the method itself is named (e.g. "the OODA loop").
2. Each item's "content" must be CONCRETE and immediately usable. Write the actual framework as a working prompt or a complete step-by-step workflow.
3. NEVER use {{variable}} placeholders or "fill in the blank" scaffolds. Write finished content an operator can apply directly.
4. Each item MUST include a "sourceQuote": a verbatim span (<=200 chars) copied from the source showing exactly where this methodology came from. This is non-negotiable — it is the verification anchor.
5. Classify each item as "prompt" (single-use guidance) or "workflow" (a multi-step process with ordered stages).
6. Choose a framework only if the extracted method genuinely follows a known structure: dsf (Discover -> Space -> Flow), rcrc (Research -> Clarify -> Recommend -> Confirm), kaizen (small iterative improvements), alchemist, or "custom".
7. If the source contains no extractable methodology, return {"items": []}. NEVER invent, generalize, or pad.

OUTPUT FORMAT — return ONLY this JSON object, no prose, no markdown fences:
{
  "items": [
    {
      "type": "prompt" | "workflow",
      "topic": "short descriptive title",
      "goal": "what an operator achieves by applying this",
      "content": "the full concrete prompt or workflow body — finished, no placeholders",
      "framework": "dsf" | "rcrc" | "kaizen" | "alchemist" | "custom" | undefined,
      "tags": ["2-5 lowercase tags"],
      "sourceQuote": "verbatim <=200 char span from the source"
    }
  ]
}`;

/** Pre-score system prompt — rates fidelity of each item against its sourceQuote. */
const PRESCORE_SYSTEM_PROMPT = `You are a fidelity auditor. You will receive a list of extracted items, each with a "sourceQuote" copied from a source document.

Rate how faithfully each item's content represents a methodology genuinely present at that sourceQuote. Score 0.0 to 1.0:
- 1.0 = the content is a faithful, faithful extraction of a clear methodology
- 0.5 = partially supported or over-generalized
- 0.0 = invented, unsupported, or contradicts the source

Return ONLY a JSON array of numbers, one per item, in order. Example for 3 items: [0.91, 0.42, 0.78]. No prose, no fences.`;

/**
 * Extract methodologies from source text via the router.
 * Runs one extraction call + one batched pre-score call.
 */
export async function extractMethodologies(
  text: string,
  sourceLabel: string,
  opts: { model?: string; maxItems?: number } = {}
): Promise<ExtractionResult> {
  const model = opts.model ?? "deepseek-v4-flash";
  const maxItems = opts.maxItems ?? DEFAULT_MAX_ITEMS;
  const sourceHash = sha256(text);
  const extractedAt = new Date().toISOString();

  // ── Extraction call ──────────────────────────────────────────────────────
  const extractionRaw = await callRouter(
    [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source label (for provenance): "${sourceLabel}"\n\nMaximum items to extract: ${maxItems}.\n\nSOURCE TEXT:\n"""\n${text}\n"""`,
      },
    ],
    { model, taskType: "methodology-extraction", quality: "high", json: true }
  );

  // Detect fallback (router down, served by local :8081 instead). Record it in
  // the provenance model field so reviewers know the extraction was degraded.
  const usedFallback = extractionRaw.startsWith(FALLBACK_MARKER);
  const cleanRaw = usedFallback ? extractionRaw.slice(FALLBACK_MARKER.length).trim() : extractionRaw;
  const effectiveModel = usedFallback ? `${model} (FALLBACK: local-primary)` : model;

  const assets = parseExtractionResponse(cleanRaw);
  if (assets.length === 0) {
    return {
      assets: [],
      provenance: { sourceLabel, sourceHash, extractedAt, model: effectiveModel },
      lowConfidenceIds: [],
    };
  }

  // ── Pre-score call (batched — one call for all items) ────────────────────
  const itemsForScoring = assets.map((a, i) => ({
    index: i,
    topic: a.topic,
    sourceQuote: a.sourceQuote,
    contentPreview: a.content.slice(0, 400),
  }));

  let scores: number[];
  try {
    const prescoreRaw = await callRouter(
      [
        { role: "system", content: PRESCORE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Score these ${itemsForScoring.length} items:\n${JSON.stringify(itemsForScoring, null, 2)}`,
        },
      ],
      { model, taskType: "methodology-prescore", quality: "low", json: true }
    );
    scores = parseScoreArray(prescoreRaw, assets.length);
  } catch {
    // Pre-score is advisory — if it fails, mark everything for review rather than blocking.
    scores = assets.map(() => 0);
  }

  // Attach scores, flag low-confidence
  const lowConfidenceIds: number[] = [];
  for (let i = 0; i < assets.length; i++) {
    assets[i].confidence = scores[i] ?? 0;
    if (assets[i].confidence < REVIEW_THRESHOLD) lowConfidenceIds.push(i);
  }

  return {
    assets,
    provenance: { sourceLabel, sourceHash, extractedAt, model: effectiveModel },
    lowConfidenceIds,
  };
}

/**
 * Parse the extraction response into validated ExtractedAssets.
 * Robust to: markdown fences, `{items:[...]}` or bare `[...]`, malformed items.
 * Drops malformed items rather than failing the whole batch.
 */
export function parseExtractionResponse(raw: string): ExtractedAsset[] {
  const cleaned = stripFences(raw).trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to salvage: find the first { ... } or [ ... ] block.
    const salvaged = extractFirstJsonBlock(cleaned);
    if (!salvaged) return [];
    try {
      parsed = JSON.parse(salvaged);
    } catch {
      return [];
    }
  }

  const rawItems = extractItemsArray(parsed);
  if (!rawItems) return [];

  const assets: ExtractedAsset[] = [];
  for (const item of rawItems) {
    const asset = normalizeAsset(item);
    if (asset) assets.push(asset);
  }
  return assets;
}

/** Parse a pre-score response into a fixed-length number array. */
export function parseScoreArray(raw: string, expected: number): number[] {
  const cleaned = stripFences(raw).trim();
  let arr: unknown;
  try {
    arr = JSON.parse(cleaned);
  } catch {
    const salvaged = extractFirstJsonBlock(cleaned);
    if (!salvaged) return new Array(expected).fill(0);
    try {
      arr = JSON.parse(salvaged);
    } catch {
      return new Array(expected).fill(0);
    }
  }
  if (!Array.isArray(arr)) return new Array(expected).fill(0);
  return Array.from({ length: expected }, (_, i) => {
    const n = Number(arr[i]);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Remove ```json ... ``` or ``` ... ``` fences. */
function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}

/** Find the first balanced JSON object or array in a string. Returns null if none. */
function extractFirstJsonBlock(s: string): string | null {
  const start = s.search(/[[{]/);
  if (start === -1) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Accept `{items:[...]}` or a bare `[...]` and return the array (or null). */
function extractItemsArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as unknown[];
    // Some models wrap differently — try common keys.
    for (const key of ["results", "assets", "methodologies", "frameworks"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return null;
}

/** Validate + normalize one raw item. Returns null if it should be dropped. */
function normalizeAsset(item: unknown): ExtractedAsset | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;

  const type = o.type;
  if (type !== "prompt" && type !== "workflow") return null;

  const content = typeof o.content === "string" ? o.content.trim() : "";
  if (!content || content.length < 40) return null; // too short to be useful

  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  if (!topic) return null;

  const sourceQuote = typeof o.sourceQuote === "string" ? o.sourceQuote.trim() : "";
  if (!sourceQuote) return null; // verification anchor is mandatory

  const goal = typeof o.goal === "string" && o.goal.trim()
    ? o.goal.trim()
    : `Apply the "${topic}" methodology`;

  const framework = normalizeFramework(o.framework);
  const tags = Array.isArray(o.tags)
    ? (o.tags as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase()).slice(0, 6)
    : [];

  // Reject content that is just placeholder scaffolding (the factory already does that).
  if (/\{\{[^}]+\}\}/.test(content)) {
    // Drop rather than fail — the model violated the contract on this item.
    return null;
  }

  return {
    type,
    topic,
    goal,
    content,
    framework,
    tags,
    sourceQuote: sourceQuote.slice(0, 200),
    confidence: 0, // filled in by pre-score
  };
}

function normalizeFramework(v: unknown): PipelineFramework | undefined {
  if (typeof v !== "string") return undefined;
  const valid: PipelineFramework[] = ["dsf", "rcrc", "kaizen", "alchemist", "custom"];
  return valid.includes(v as PipelineFramework) ? (v as PipelineFramework) : undefined;
}
