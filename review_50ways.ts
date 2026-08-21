/**
 * Review Gate Run — 50 Ways (Anti-Slop) drafts, 2026-08-17
 *
 * Submits each 50Ways draft to the mindsclip3 Board Meeting (Rune fidelity +
 * Alex license). APPROVE → promote to "ready". REVISE/REJECT → stay draft,
 * capture notes for the report.
 *
 *   bun run review_50ways.ts
 */

import {
  getWarehouseCatalog,
  getWarehouseItemContent,
  updateWarehouseItem,
} from "./src/warehouse/catalog.ts";
import { requestReview } from "./src/pipeline/review.ts";
import type { WarehouseItem } from "./src/warehouse/types.ts";

const LABEL_MATCH = "50 Ways";

const catalog = getWarehouseCatalog();
const drafts: WarehouseItem[] = catalog.items.filter(
  (i) =>
    i.status === "draft" &&
    (i.provenance?.sourceLabel ?? "").includes(LABEL_MATCH)
);

console.log(`gate run: ${drafts.length} x 50Ways drafts → Rune + Alex board review`);
const tally = { APPROVE: 0, REVISE: 0, REJECT: 0, ERROR: 0 };

for (const item of drafts) {
  const content = getWarehouseItemContent(item);
  const t0 = Date.now();
  try {
    const result = await requestReview({
      title: item.title,
      content,
      reviewers: ["rune-pattern", "alex-clo"], // mindsclip3 model IDs (Rune + Alex)
      provenance: item.provenance,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    tally[result.verdict] = (tally[result.verdict] ?? 0) + 1;

    if (result.verdict === "APPROVE") {
      updateWarehouseItem(item.id, { status: "ready" });
      console.log(`✅ APPROVE (${secs}s) — ${item.title} → ready`);
    } else {
      console.log(`⚠️  ${result.verdict} (${secs}s) — ${item.title}`);
      console.log(`   notes: ${result.notes.slice(0, 220).replace(/\n/g, " ")}`);
    }
  } catch (e: any) {
    tally.ERROR++;
    console.log(`❌ ERROR — ${item.title}: ${e.message?.slice(0, 160)}`);
  }
}

console.log(`\ntally: ${JSON.stringify(tally)}`);
console.log(
  `promoted: ${catalog.items.filter((i) => i.status === "ready").length} items now ready`
);
