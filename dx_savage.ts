/**
 * Savage all-zeros DX — 2026-08-17
 *
 * Question: are the 0.00 pre-scores genuine (auditor judges identity-framework
 * extractions unsupported against first-person quotes) or a parse failure?
 *
 * Method: run a small extraction on a Savage slice (no save) AND fire the
 * pre-score call directly with the returned quotes — printing the RAW model
 * response so we see exactly what the parser receives.
 *
 *   bun run dx_savage.ts
 */

import { readFileSync } from "fs";
import { extractMethodologies } from "./src/pipeline/extractor.ts";
import { callRouter } from "./src/pipeline/router-client.ts";

// Inlined from extractor.ts (module-private there)
const PRESCORE_SYSTEM_PROMPT = `You are a fidelity auditor. You will receive a list of extracted items, each with a "sourceQuote" copied from a source document.

Rate how faithfully each item's content represents a methodology genuinely present at that sourceQuote. Score 0.0 to 1.0:
- 1.0 = the content is a faithful, faithful extraction of a clear methodology
- 0.5 = partially supported or over-generalized
- 0.0 = invented, unsupported, or contradicts the source

Return ONLY a JSON array of numbers, one per item, in order. Example for 3 items: [0.91, 0.42, 0.78]. No prose, no fences.`;

const full = readFileSync("/tmp/savage-full.txt", "utf-8");
// Slice: the first 3 frameworks — enough for a clean probe
const slice = full.split("=====").slice(0, 7).join("=====");

console.log(`── pass 1: extraction (save:false), ${slice.length} chars ──`);
const result = await extractMethodologies(slice, "DX: Savage slice", { maxItems: 3 });

console.log(`assets: ${result.assets.length}`);
for (const a of result.assets) {
  console.log(`  • ${a.topic} | conf ${a.confidence.toFixed(2)} | quote: "${a.sourceQuote.slice(0, 60)}..."`);
}

if (result.assets.length > 0) {
  console.log(`\n── pass 2: direct pre-score call, RAW response ──`);
  const itemsForScoring = result.assets.map((a, i) => ({
    index: i,
    topic: a.topic,
    sourceQuote: a.sourceQuote,
    contentPreview: a.content.slice(0, 400),
  }));
  const raw = await callRouter(
    [
      { role: "system", content: PRESCORE_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(itemsForScoring, null, 2) },
    ],
    { model: "deepseek-v4-flash", taskType: "prescore", quality: "high", json: true }
  );
  console.log("RAW PRESCORE RESPONSE (verbatim, first 600 chars):");
  console.log(raw.slice(0, 600));
}
