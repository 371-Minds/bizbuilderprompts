/**
 * Revise-loop re-review — 2026-08-22
 *
 * Re-reviews the 9 held 50Ways drafts AFTER the [extension]/trim revise pass.
 * Mirrors the review_draft tool: full transcript to warehouse/reviews/, review
 * metadata on the item, APPROVE → status 'ready'. filePath entries in
 * index.json are absolute (main checkout), so they are re-anchored to this
 * checkout before content reads.
 *
 *   bun run revisit_50ways.ts
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

const ROOT = import.meta.dir;
const REVIEWS_DIR = join(ROOT, "warehouse", "reviews");
mkdirSync(REVIEWS_DIR, { recursive: true });

const REVIEWERS = ["rune-pattern", "alex-clo"] as const;

const catalog = getWarehouseCatalog();
const held: WarehouseItem[] = catalog.items.filter(
  (i) => i.status === "draft" && (i.provenance?.sourceLabel ?? "").includes("50 Ways")
);

console.log(`re-reviewing ${held.length} revised drafts (post [extension] pass)`);
const tally: Record<string, number> = { APPROVE: 0, REVISE: 0, REJECT: 0, ERROR: 0 };
const outcomes: Array<{ id: string; title: string; verdict: string }> = [];

for (const item of held) {
  const localPath = join(ROOT, item.filePath.replace(/^.*?\/warehouse\//, "warehouse/"));
  const content = getWarehouseItemContent({ ...item, filePath: localPath });
  const t0 = Date.now();
  try {
    const review = await requestReview({
      title: item.title,
      content,
      reviewers: [...REVIEWERS],
      provenance: item.provenance,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    tally[review.verdict] = (tally[review.verdict] ?? 0) + 1;
    outcomes.push({ id: item.id, title: item.title, verdict: review.verdict });

    const reviewedAt = new Date().toISOString();
    updateWarehouseItem(item.id, {
      ...(review.verdict === "APPROVE" ? { status: "ready" as const } : {}),
      review: {
        verdict: review.verdict,
        reviewedAt,
        reviewers: [...REVIEWERS],
        notes: review.notes,
        transcriptExcerpt: review.transcript.slice(0, 1500),
      },
    });

    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    writeFileSync(
      join(REVIEWS_DIR, `${slug}.md`),
      `# Board Review — ${item.title}\n\n` +
        `- **Warehouse ID:** ${item.id}\n` +
        `- **Verdict:** ${review.verdict}\n` +
        `- **Reviewers:** Rune (fidelity), Alex (license)\n` +
        `- **Reviewed:** ${reviewedAt}\n\n` +
        `## Notes\n\n${review.notes}\n\n---\n\n## Transcript\n\n${review.transcript}\n`
    );

    console.log(
      review.verdict === "APPROVE"
        ? `✅ APPROVE (${secs}s) — ${item.title} → ready`
        : `⚠️  ${review.verdict} (${secs}s) — ${item.title} → stays draft, transcript saved`
    );
  } catch (e: any) {
    tally.ERROR++;
    outcomes.push({ id: item.id, title: item.title, verdict: "ERROR" });
    console.log(`❌ ERROR — ${item.title}: ${e.message?.slice(0, 140)}`);
  }
}

console.log(`\ntally: ${JSON.stringify(tally)}`);
writeFileSync(
  join(ROOT, "revisit_outcomes.json"),
  JSON.stringify({ tally, outcomes }, null, 2)
);
