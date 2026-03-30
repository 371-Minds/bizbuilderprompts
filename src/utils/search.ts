import Fuse from "fuse.js";
import type { PromptEntry } from "../types.js";

export interface SearchResult {
  item: PromptEntry;
  score: number;
  excerpt: string;
}

let fuseInstance: Fuse<PromptEntry> | null = null;

export function buildSearchIndex(prompts: PromptEntry[]): void {
  fuseInstance = new Fuse(prompts, {
    keys: [
      { name: "title", weight: 0.4 },
      { name: "description", weight: 0.3 },
      { name: "tags", weight: 0.2 },
      { name: "category", weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

export function searchPrompts(
  query: string,
  prompts: PromptEntry[],
  limit = 10
): SearchResult[] {
  if (!fuseInstance) {
    buildSearchIndex(prompts);
  }
  const raw = fuseInstance!.search(query, { limit });
  return raw.map((r) => ({
    item: r.item,
    score: Math.round((1 - (r.score ?? 0)) * 100) / 100,
    excerpt: buildExcerpt(r.item),
  }));
}

function buildExcerpt(entry: PromptEntry): string {
  const parts: string[] = [entry.description];
  if (entry.tags.length > 0) {
    parts.push(`Tags: ${entry.tags.join(", ")}`);
  }
  if (entry.variables.length > 0) {
    parts.push(`Variables: ${entry.variables.join(", ")}`);
  }
  return parts.join(" | ");
}

/**
 * Keyword-based suggestion: scores prompts by overlap with goal text.
 * Returns entries ranked by relevance with a human-readable reason.
 */
export function suggestPrompts(
  goal: string,
  prompts: PromptEntry[],
  limit = 5
): Array<PromptEntry & { reason: string }> {
  const goalWords = tokenize(goal);
  const scored = prompts.map((p) => {
    const fields = [
      p.title,
      p.description,
      p.category,
      ...p.tags,
    ]
      .join(" ")
      .toLowerCase();
    const fieldTokens = new Set(tokenize(fields));

    let matches = 0;
    const matchedTerms: string[] = [];
    for (const word of goalWords) {
      if (fieldTokens.has(word) || fields.includes(word)) {
        matches++;
        if (!matchedTerms.includes(word)) matchedTerms.push(word);
      }
    }
    const score = matches / Math.max(goalWords.length, 1);
    const reason =
      matchedTerms.length > 0
        ? `Matched terms: ${matchedTerms.slice(0, 4).join(", ")}`
        : "General business relevance";
    return { ...p, score, reason };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./\\()\-_]+/)
    .filter((t) => t.length > 2);
}
