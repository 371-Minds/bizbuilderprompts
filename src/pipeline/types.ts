/**
 * Methodology-extraction pipeline types.
 *
 * The pipeline turns source text (PLR, CORTEX convos, research docs, etc.) into
 * concrete BizBuilder warehouse assets via the 371 Router. Every extracted asset
 * carries provenance so any claim can be traced back to its source.
 *
 * Design constraints:
 *   - `content` is CONCRETE and immediately usable — never `{{variable}}` scaffolds.
 *     The factory's templated crafters are the wrong tool for extracted knowledge.
 *   - `provenance.sourceHash` is computed inline (SHA-256) — zero infra required.
 */

/** Workflows known to the factory's WorkflowFramework union. */
export type PipelineFramework = "dsf" | "rcrc" | "kaizen" | "alchemist" | "custom";

/**
 * Provenance block attached to every extracted asset.
 * Stored on `WarehouseItem.provenance` so any reviewer can re-fetch the source
 * and verify a claim against `sourceQuote` + `sourceHash`.
 */
export interface Provenance {
  /** Human label for the source, e.g. "CORTEX housing convo". */
  sourceLabel: string;
  /** SHA-256 of the source text. */
  sourceHash: string;
  /** ISO timestamp of extraction. */
  extractedAt: string;
  /** Router model used for extraction (e.g. "deepseek-v4-flash"). */
  model: string;
}

/**
 * One extracted reusable asset — a methodology or decision framework,
 * rendered as a ready-to-use prompt or step-by-step workflow.
 */
export interface ExtractedAsset {
  type: "prompt" | "workflow";
  topic: string;
  goal: string;
  /** Concrete, ready-to-use content. No `{{variable}}` placeholders. */
  content: string;
  framework?: PipelineFramework;
  tags: string[];
  /** Verbatim span (≤200 chars) from the source showing where this came from. */
  sourceQuote: string;
  /** Pre-score fidelity 0–1 against the sourceQuote. */
  confidence: number;
}

/** Full result of one extraction pass over a source. */
export interface ExtractionResult {
  assets: ExtractedAsset[];
  provenance: Provenance;
  /** Indices into `assets` where confidence fell below the review threshold. */
  lowConfidenceIds: number[];
}
