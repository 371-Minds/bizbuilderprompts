import { writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, readFileSync } from "fs";
import { join, extname, basename } from "path";
import { classify, CATEGORY_DEFINITIONS } from "./classifier.js";
import type {
  IngestionInput,
  ClassificationResult,
  IngestionResult,
  IngestOptions,
} from "./types.js";

const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

// Map category names to their directory paths relative to the repo root
const CATEGORY_DIR_MAP: Record<string, string> = {
  sales: "sales",
  marketing: "marketing",
  video: "video_prompts",
  "image-prompt": "image_prompts/veo/prompts",
  project: "projects",
  promotion: "promotion_prompts_examples",
  business_strategy: "business_strategy",
  customer_success: "customer_success",
  general: "general",
  // Workflows require a full run_* directory structure; route to incoming for human review
  workflow: "incoming_prompts/workflows",
};

function resolveTargetDir(category: string): string {
  const relDir = CATEGORY_DIR_MAP[category] ?? category;
  return join(REPO_ROOT, relDir);
}

function resolveTargetPath(
  category: string,
  filename: string,
  overwrite: boolean
): string {
  const dir = resolveTargetDir(category);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const base = basename(filename);
  const targetPath = join(dir, base);

  if (overwrite || !existsSync(targetPath)) {
    return targetPath;
  }

  // Collision handling: append _1, _2, etc. (mirrors Python classifier logic)
  const ext = extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let counter = 1;
  let candidate = join(dir, `${stem}_${counter}${ext}`);
  while (existsSync(candidate)) {
    counter++;
    candidate = join(dir, `${stem}_${counter}${ext}`);
  }
  return candidate;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Classify content without writing any files. */
export function classifyOnly(input: IngestionInput): ClassificationResult {
  return classify(input);
}

/** Classify content and optionally write it to the appropriate category directory. */
export async function ingestPrompt(
  input: IngestionInput,
  options: IngestOptions = {}
): Promise<IngestionResult> {
  const { save = false, overwrite = false } = options;
  const classification = classify(input);

  if (!save) {
    return { ...classification, saved: false };
  }

  const filename = classification.suggestedFilename;
  const targetPath = resolveTargetPath(classification.category, filename, overwrite);

  writeFileSync(targetPath, input.content, "utf-8");

  return {
    ...classification,
    saved: true,
    path: targetPath,
  };
}

/** Returns category taxonomy info (for MCP tool: list_ingestion_categories). */
export function listIngestionCategories(): Array<{
  name: string;
  description: string;
  dirPath: string;
  exampleKeywords: string[];
}> {
  return CATEGORY_DEFINITIONS.map((c) => ({
    name: c.name,
    description: c.description,
    dirPath: CATEGORY_DIR_MAP[c.name] ?? c.dirPath,
    exampleKeywords: c.keywords.slice(0, 6),
  }));
}

// ── CLI mode (Bun: bun src/ingestion/ingester.ts) ────────────────────────────

async function runCli(): Promise<void> {
  const INCOMING_DIR = join(REPO_ROOT, "incoming_prompts");

  if (!existsSync(INCOMING_DIR)) {
    console.log("No incoming_prompts/ directory found. Nothing to do.");
    return;
  }

  let files: string[];
  try {
    files = readdirSync(INCOMING_DIR).filter((f) => {
      const ext = extname(f).toLowerCase();
      return ext === ".md" || ext === ".txt" || ext === ".json";
    });
  } catch {
    console.error("Failed to read incoming_prompts/ directory.");
    process.exit(1);
    return;
  }

  if (files.length === 0) {
    console.log("No prompt files found in incoming_prompts/. Nothing to do.");
    return;
  }

  console.log(`Found ${files.length} prompt(s) to process.\n`);

  let processed = 0;
  let failed = 0;

  for (const file of files) {
    const srcPath = join(INCOMING_DIR, file);
    let content: string;
    try {
      content = readFileSync(srcPath, "utf-8");
    } catch {
      console.error(`  ✗ Failed to read: ${file}`);
      failed++;
      continue;
    }

    const result = await ingestPrompt(
      { content, filename: file },
      { save: true, overwrite: false }
    );

    if (result.saved && result.path) {
      // Mark the original file as processed so it isn't re-ingested
      try {
        renameSync(srcPath, `${srcPath}.processed`);
      } catch {
        // Non-fatal: file was already classified and saved
      }
      const pct = (result.confidence * 100).toFixed(0);
      console.log(`  ✓ ${file} → ${result.category}/ (confidence: ${pct}%)`);
      console.log(`    Saved to: ${result.path}`);
      if (result.confidence < 0.5) {
        console.log(`    ⚠ Low confidence — please verify category manually`);
      }
      processed++;
    } else {
      console.error(`  ✗ Failed to save: ${file}`);
      failed++;
    }
  }

  console.log(`\nDone. Processed: ${processed}, Failed: ${failed}`);
}

// Bun exposes import.meta.main = true when the file is the entry point
if (import.meta.main) {
  runCli().catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
