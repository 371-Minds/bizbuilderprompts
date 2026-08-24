/**
 * C-Suite re-review gate for the 15 re-authored 50Ways assets — 2026-08-23.
 *
 * License resolution: the 15 items were re-authored as original 371 content
 * (provenance removed). Alex (CLO) reviews for originality — diff against the
 * source PDF at the repo root; PASS only if expressionally independent.
 * Rune reviews usefulness/fidelity-to-practice. Verdicts honored:
 * APPROVE promotes to ready. Transcripts persisted to warehouse/reviews/
 * (review_draft format). Run:
 *
 *   bun run reauthor_review.ts [idSubstring ...]
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getWarehouseCatalog,
  getWarehouseItemContent,
  updateWarehouseItem,
} from "./src/warehouse/catalog.ts";
import { requestReview } from "./src/pipeline/review.ts";
import type { WarehouseItem } from "./src/warehouse/types.ts";

const REVIEWER_FOCUS = `**REVIEWER INSTRUCTIONS (override defaults):**
- alex-clo (CLO): originality check — diff against the source PDF at ../50WaysToAvoidLazyAISlopAndCreateContentPeopleWant.pdf (repo root); flag any parallel expression, shared phrasing, or structural copying; PASS only if expressionally independent.
- rune-pattern: usefulness and fidelity-to-practice review of this ORIGINAL 371 asset (not an extraction — no sourceQuote to verify).

---

`;

const REVIEWS_DIR = join(import.meta.dir, "warehouse", "reviews");
mkdirSync(REVIEWS_DIR, { recursive: true });

const IDS = [
  "warehouse-extracted-start-with-one-reader-problem-mt38e0w2",
  "warehouse-extracted-one-sentence-audience-definition-mt38e0w2",
  "warehouse-extracted-one-main-takeaway-per-piece-mt38e0w3",
  "warehouse-extracted-promise-driven-opening-mt38e0w3",
  "warehouse-extracted-guardrail-outline-before-drafting-mt38e0w3",
  "warehouse-extracted-ruthless-fluff-cut-mt38e0w3",
  "warehouse-extracted-concrete-specifics-replace-vague-claims-mt38e0w3",
  "warehouse-extracted-story-first-proof-mt38e0w4",
  "warehouse-extracted-specifics-forcing-ai-prompt-mt38e0w4",
  "warehouse-extracted-give-ai-audience-context-upfront-mt38e0w4",
  "warehouse-extracted-ai-as-structure-generator-mt38e0w5",
  "warehouse-extracted-skeptic-proofing-with-ai-mt38e0w5",
  "warehouse-extracted-headline-and-subhead-generation-mt38e0w5",
  "warehouse-extracted-picky-editor-gap-check-mt38e0w5",
  "warehouse-extracted-real-reader-confusion-test-mt38e0w5",
];

const catalog = getWarehouseCatalog();
const filters = process.argv.slice(2);
const targets: WarehouseItem[] = catalog.items.filter(
  (i) => IDS.includes(i.id) && (filters.length === 0 || filters.some((f) => i.id.includes(f) || i.title.toLowerCase().includes(f.toLowerCase())))
);

console.log(`re-authoring gate: reviewing ${targets.length} items`);
const tally: Record<string, number> = { APPROVE: 0, REVISE: 0, REJECT: 0, ERROR: 0 };
const reviseQueue: string[] = [];

for (const item of targets) {
  const content = REVIEWER_FOCUS + getWarehouseItemContent(item);
  const t0 = Date.now();
  try {
    const result = await requestReview({
      title: item.title,
      content,
      reviewers: ["rune-pattern", "alex-clo"],
      // no provenance: commissioned/original asset pattern
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    tally[result.verdict] = (tally[result.verdict] ?? 0) + 1;

    const reviewedAt = new Date().toISOString();
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    writeFileSync(
      join(REVIEWS_DIR, `${slug}.md`),
      `# Board Review — ${item.title}\n\n` +
        `- **Warehouse ID:** ${item.id}\n` +
        `- **Verdict:** ${result.verdict}\n` +
        `- **Reviewers:** rune-pattern (usefulness), alex-clo (originality diff vs source PDF)\n` +
        `- **Reviewed:** ${reviewedAt}\n\n` +
        `## Notes\n\n${result.notes}\n\n---\n\n## Transcript\n\n${result.transcript}\n`
    );

    updateWarehouseItem(item.id, {
      ...(result.verdict === "APPROVE" ? { status: "ready" as const } : {}),
      review: {
        verdict: result.verdict,
        reviewedAt,
        reviewers: ["rune-pattern", "alex-clo"],
        notes: result.notes,
        transcriptExcerpt: result.transcript.slice(0, 1500),
      },
    });

    if (result.verdict === "APPROVE") {
      console.log(`✅ APPROVE (${secs}s) — ${item.title} → ready`);
    } else {
      reviseQueue.push(item.id);
      console.log(`⚠️  ${result.verdict} (${secs}s) — ${item.title} → draft held, transcript saved`);
      console.log(`    notes: ${result.notes.slice(0, 300).replace(/\n/g, " ")}`);
    }
  } catch (e: any) {
    tally.ERROR++;
    console.log(`❌ ERROR — ${item.title}: ${e.message?.slice(0, 140)}`);
  }
}

console.log(`\ntally: ${JSON.stringify(tally)}`);
if (reviseQueue.length) console.log(`revise queue: ${reviseQueue.join(", ")}`);
