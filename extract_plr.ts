/**
 * PLR Volume Extraction Run — 2026-08-17
 *
 * Transforms two raw PLR sources into 371-branded warehouse drafts via the
 * sovereign methodology pipeline (371 Router :3000, fallback :8081).
 * Not for resale as-is: PLR in raw form is already saturating the wild.
 * The transformed, provenance-hashed output is the sellable/training asset.
 *
 *   bun run extract_plr.ts
 */

import { readFileSync } from "fs";
import { extractAndSave } from "./src/pipeline/index.ts";

const RUNS: Array<{ file: string; label: string; maxItems: number }> = [
  {
    file: "/tmp/50ways-full.txt",
    label: "PLR: 50 Ways to Avoid Lazy AI Slop (SuperSalesMachine) — 371 transformation pass 1",
    maxItems: 15,
  },
  {
    file: "/tmp/savage-full.txt",
    label: "PLR: Savage Prompts — 100 Identity Frameworks (SuperGoodProduct) — 371 transformation pass 1",
    maxItems: 15,
  },
];

for (const run of RUNS) {
  console.log(`\n════════════════════════════════════════════════`);
  console.log(`SOURCE: ${run.label}`);
  console.log(`════════════════════════════════════════════════`);

  const text = readFileSync(run.file, "utf-8");
  console.log(`input: ${text.length} chars | maxItems: ${run.maxItems}`);

  const t0 = Date.now();
  const result = await extractAndSave(text, run.label, { maxItems: run.maxItems });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nextracted ${result.count} assets in ${secs}s (model-attributed via router key)`);
  for (const a of result.saved) {
    const flag = a.reviewRequired ? " ⟵ MANDATORY REVIEW (low pre-score)" : "";
    console.log(`  [${a.type}] ${a.title} (conf ${a.confidence.toFixed(2)})${flag}`);
  }
  if (result.reviewQueue.length > 0) {
    console.log(`\nreview queue: ${result.reviewQueue.length} items flagged for Rune+Alex gate`);
  }
}
console.log("\ndone — drafts in warehouse/, awaiting review_draft gate.");
