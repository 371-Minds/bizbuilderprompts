/**
 * REVISE transcript recovery — 2026-08-17
 *
 * The first gate run parsed verdicts but discarded transcripts (the thin
 * "VERDICT: REVISE" notes). This pass re-reviews the 11 held 50Ways drafts
 * and PERSISTS the full board transcripts to warehouse/reviews/ so the
 * reasoning is auditable. Verdicts are honored as before (APPROVE promotes).
 *
 *   bun run revise_transcripts.ts
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

const REVIEWS_DIR = join(import.meta.dir, "warehouse", "reviews");
mkdirSync(REVIEWS_DIR, { recursive: true });

const catalog = getWarehouseCatalog();
const held: WarehouseItem[] = catalog.items.filter(
  (i) => i.status === "draft" && (i.provenance?.sourceLabel ?? "").includes("50 Ways")
);

console.log(`re-reviewing ${held.length} held drafts — full transcripts to warehouse/reviews/`);
const tally: Record<string, number> = { APPROVE: 0, REVISE: 0, REJECT: 0, ERROR: 0 };

for (const item of held) {
  const content = getWarehouseItemContent(item);
  const t0 = Date.now();
  try {
    const result = await requestReview({
      title: item.title,
      content,
      reviewers: ["rune-pattern", "alex-clo"],
      provenance: item.provenance,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    tally[result.verdict] = (tally[result.verdict] ?? 0) + 1;

    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    writeFileSync(
      join(REVIEWS_DIR, `${slug}.md`),
      `# Board Review — ${item.title}\n\n` +
        `- **Warehouse ID:** ${item.id}\n` +
        `- **Verdict:** ${result.verdict}\n` +
        `- **Reviewers:** Rune (fidelity), Alex (license)\n` +
        `- **Reviewed:** ${new Date().toISOString()}\n\n` +
        `## Notes\n\n${result.notes}\n\n---\n\n## Transcript\n\n${result.transcript}\n`
    );

    if (result.verdict === "APPROVE") {
      updateWarehouseItem(item.id, { status: "ready" });
      console.log(`✅ APPROVE (${secs}s) — ${item.title} → ready`);
    } else {
      console.log(`⚠️  ${result.verdict} (${secs}s) — ${item.title} → transcript saved`);
    }
  } catch (e: any) {
    tally.ERROR++;
    console.log(`❌ ERROR — ${item.title}: ${e.message?.slice(0, 140)}`);
  }
}

console.log(`\ntally: ${JSON.stringify(tally)}`);
console.log(`transcripts: warehouse/reviews/`);
