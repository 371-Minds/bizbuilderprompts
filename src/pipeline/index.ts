/**
 * Pipeline orchestration — extract methodologies from text and save them to the
 * warehouse as draft assets.
 *
 * Reuses existing warehouse plumbing (addToWarehouse, getWarehouseSubdir) so
 * extracted assets are immediately queryable via browse_warehouse. The factory's
 * own dispatch() is deliberately NOT used here — the factory generates templated
 * scaffolds full of {{variables}}, but extracted knowledge is concrete instance
 * content. We share the *plumbing* (disk write + warehouse registration), not
 * the *content generation*.
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { extractMethodologies } from "./extractor.js";
import { sha256 } from "./router-client.js";
import type { ExtractedAsset, Provenance } from "./types.js";
import {
  addToWarehouse,
  getWarehouseSubdir,
} from "../warehouse/catalog.js";
import type { WarehouseItem } from "../warehouse/types.js";

export interface ExtractAndSaveOptions {
  /** Override the default extraction model (deepseek-v4-flash). */
  model?: string;
  /** Max items to extract. Default 8. */
  maxItems?: number;
  /** Save to disk + warehouse (default true). If false, returns the drafts only. */
  save?: boolean;
}

export interface SavedAsset {
  warehouseId: string;
  title: string;
  type: "prompt" | "workflow";
  confidence: number;
  filePath: string;
  status: "draft";
  reviewRequired: boolean;
}

export interface ExtractAndSaveResult {
  provenance: Provenance;
  saved: SavedAsset[];
  /** Subset of `saved` flagged for mandatory review (low pre-score). */
  reviewQueue: SavedAsset[];
  count: number;
}

/**
 * Extract methodologies from source text and persist them as draft warehouse assets.
 *
 * @param text the source document text
 * @param sourceLabel human-readable provenance label
 */
export async function extractAndSave(
  text: string,
  sourceLabel: string,
  opts: ExtractAndSaveOptions = {}
): Promise<ExtractAndSaveResult> {
  const save = opts.save ?? true;

  const result = await extractMethodologies(text, sourceLabel, {
    model: opts.model,
    maxItems: opts.maxItems,
  });

  if (result.assets.length === 0) {
    return { provenance: result.provenance, saved: [], reviewQueue: [], count: 0 };
  }

  const saved: SavedAsset[] = [];
  const lowConfidenceSet = new Set(result.lowConfidenceIds);

  for (let i = 0; i < result.assets.length; i++) {
    const asset = result.assets[i];
    const reviewRequired = lowConfidenceSet.has(i);

    if (save) {
      const record = saveAssetToWarehouse(asset, result.provenance);
      saved.push({
        warehouseId: record.warehouseId,
        title: record.title,
        type: asset.type,
        confidence: asset.confidence,
        filePath: record.filePath,
        status: "draft",
        reviewRequired,
      });
    } else {
      saved.push({
        warehouseId: `(unsaved) ${asset.topic}`,
        title: asset.topic,
        type: asset.type,
        confidence: asset.confidence,
        filePath: "",
        status: "draft",
        reviewRequired,
      });
    }
  }

  return {
    provenance: result.provenance,
    saved,
    reviewQueue: saved.filter((s) => s.reviewRequired),
    count: saved.length,
  };
}

/** Resolve a `source` tool arg: if it's an existing file path, read it; else treat as text. */
export function resolveSourceText(source: string): { text: string; fromFile: boolean } {
  if (source.trim().startsWith("/")) {
    try {
      if (existsSync(source)) {
        return { text: readFileSync(source, "utf-8"), fromFile: true };
      }
    } catch {
      // fall through — treat as literal text
    }
  }
  return { text: source, fromFile: false };
}

// ── Internal: write + register one asset ───────────────────────────────────

interface SavedRecord {
  warehouseId: string;
  title: string;
  filePath: string;
}

function saveAssetToWarehouse(asset: ExtractedAsset, provenance: Provenance): SavedRecord {
  const subdir = getWarehouseSubdir(asset.type === "workflow" ? "workflow" : "prompt");
  const slug = slugify(asset.topic);
  const ext = asset.type === "workflow" ? ".md" : ".md";
  const baseName = `${slug}${ext}`;
  const filePath = resolveFilePath(join(subdir, baseName));

  const content = renderAssetContent(asset, provenance);
  writeFileSync(filePath, content, "utf-8");

  const warehouseId = `warehouse-extracted-${slug}-${Date.now().toString(36)}`;
  const item: WarehouseItem = {
    id: warehouseId,
    type: asset.type === "workflow" ? "workflow" : "prompt",
    title: asset.topic,
    description: asset.goal,
    targetRoles: [],
    useCase: asset.goal,
    status: "draft",
    commissionedAt: provenance.extractedAt,
    linkedItems: [],
    tags: [...asset.tags, "extracted", asset.type, ...(asset.framework ? [asset.framework] : [])],
    variables: [],
    filePath,
    category: asset.type === "workflow" ? "workflow" : "general",
    provenance,
  };

  addToWarehouse(item);

  return { warehouseId, title: asset.topic, filePath };
}

/** Render the on-disk markdown for an extracted asset. */
function renderAssetContent(asset: ExtractedAsset, provenance: Provenance): string {
  const lines: string[] = [
    `# ${asset.topic}`,
    "",
    `> **Goal:** ${asset.goal}`,
    ...(asset.framework ? [`> **Framework:** ${asset.framework}`] : []),
    ...(asset.tags.length ? [`> **Tags:** ${asset.tags.join(", ")}`] : []),
    "",
    "---",
    "",
    "## Methodology",
    "",
    asset.content,
    "",
    "---",
    "",
    "## Provenance",
    "",
    `- **Source:** ${provenance.sourceLabel}`,
    `- **Source hash:** \`${provenance.sourceHash}\``,
    `- **Extracted:** ${provenance.extractedAt} via ${provenance.model}`,
    `- **Fidelity pre-score:** ${asset.confidence.toFixed(2)}`,
    "",
    "### Source quote (verification anchor)",
    "",
    `> ${asset.sourceQuote}`,
    "",
  ];
  return lines.join("\n");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Inline collision handler — mirrors the factory's private resolveFilePath. */
function resolveFilePath(targetPath: string): string {
  if (!existsSync(targetPath)) return targetPath;
  const lastDot = targetPath.lastIndexOf(".");
  const stem = lastDot > 0 ? targetPath.slice(0, lastDot) : targetPath;
  const ext = lastDot > 0 ? targetPath.slice(lastDot) : "";
  let counter = 1;
  let candidate = `${stem}_${counter}${ext}`;
  while (existsSync(candidate)) {
    counter++;
    candidate = `${stem}_${counter}${ext}`;
  }
  return candidate;
}

export { sha256 };
