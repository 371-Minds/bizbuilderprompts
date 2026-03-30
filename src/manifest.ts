import { readFileSync, statSync } from "fs";
import { join, basename, extname, dirname, relative } from "path";
import { glob } from "glob";
import type { Manifest, PromptEntry, WorkflowEntry, WorkflowStep } from "./types.js";
import { extractVariables } from "./utils/template.js";

const REPO_ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");

const PROMPT_EXTENSIONS = new Set([".md", ".txt", ".json", ""]);

const CATEGORY_META: Record<string, { tags: string[]; description: string }> = {
  marketing: {
    tags: ["marketing", "growth", "brand", "strategy"],
    description: "Marketing and growth strategies",
  },
  sales: {
    tags: ["sales", "conversion", "copywriting", "persuasion"],
    description: "Sales techniques and copywriting",
  },
  "image-prompt": {
    tags: ["image", "video", "visual", "product", "creative"],
    description: "Visual and video generation prompts",
  },
  project: {
    tags: ["project", "template", "build", "startup", "product"],
    description: "Project idea templates and blueprints",
  },
  promotion: {
    tags: ["promotion", "marketing", "ads", "copywriting"],
    description: "Promotional copy and marketing examples",
  },
  video: {
    tags: ["video", "thumbnail", "content", "visual"],
    description: "Video content and thumbnail generation",
  },
  general: {
    tags: ["general", "business"],
    description: "General business prompts",
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromFilename(filePath: string): string {
  const name = basename(filePath);
  const noExt = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  return noExt
    .replace(/^\d+[_-]/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function inferDescription(content: string, title: string): string {
  const firstLine = content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 20 && !l.startsWith("#") && !l.startsWith("<") && !l.startsWith("---") && !l.startsWith("{"));
  if (firstLine && firstLine.length < 200) {
    return firstLine.replace(/^[*-]\s*/, "").slice(0, 150);
  }
  return `${title} prompt`;
}

function inferTags(filePath: string, content: string, category: string): string[] {
  const base = new Set<string>(CATEGORY_META[category]?.tags ?? []);
  const text = (filePath + " " + content.slice(0, 500)).toLowerCase();
  const keywords = [
    "strategy", "growth", "marketing", "sales", "legal", "compliance",
    "copywriting", "conversion", "workflow", "project", "startup", "ai",
    "automation", "content", "brand", "product", "finance", "tax",
    "linkedin", "patent", "trademark", "dao", "viral", "onboarding",
    "kaizen", "coaching", "business", "template", "framework",
  ];
  for (const kw of keywords) {
    if (text.includes(kw)) base.add(kw);
  }
  return Array.from(base).slice(0, 8);
}

function readFileSafe(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return PROMPT_EXTENSIONS.has(ext);
}

function makePromptEntry(
  filePath: string,
  category: string,
  idPrefix: string,
  overrides: Partial<PromptEntry> = {}
): PromptEntry {
  const content = readFileSafe(filePath);
  const title = overrides.title ?? titleFromFilename(filePath);
  const id = overrides.id ?? `${idPrefix}-${slugify(title)}`;
  const variables = extractVariables(content);
  const tags = inferTags(filePath, content, category);
  const description = inferDescription(content, title);
  const ext = extname(filePath).toLowerCase();
  const mimeType =
    ext === ".json"
      ? "application/json"
      : ext === ".md"
      ? "text/markdown"
      : "text/plain";

  return {
    id,
    title,
    category,
    tags,
    description,
    variables,
    filePath,
    fileType: "prompt",
    mimeType,
    ...overrides,
  };
}

async function scanFlatDirectory(
  dirPath: string,
  category: string,
  idPrefix: string
): Promise<PromptEntry[]> {
  const entries: PromptEntry[] = [];
  let files: string[] = [];
  try {
    files = await glob("*", { cwd: dirPath, nodir: true });
  } catch {
    return entries;
  }
  for (const file of files) {
    if (!isTextFile(file)) continue;
    const fullPath = join(dirPath, file);
    entries.push(makePromptEntry(fullPath, category, idPrefix));
  }
  return entries;
}

async function scanWorkflowDirectory(
  dirPath: string
): Promise<{ workflow: WorkflowEntry; steps: PromptEntry[] }> {
  const dirName = basename(dirPath);
  const workflowId = slugify(dirName.replace(/^run_/, ""));
  const title = dirName
    .replace(/^run_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const allFiles = await glob("**/*", { cwd: dirPath, nodir: true });
  const masterFile = allFiles.find((f) => basename(f) === "master_prompt.md");
  const masterPath = masterFile ? join(dirPath, masterFile) : undefined;

  const masterContent = masterPath ? readFileSafe(masterPath) : "";
  const description = masterContent
    ? inferDescription(masterContent, title)
    : `${title} workflow`;
  const tags = inferTags(dirPath, masterContent, "workflow");

  const PHASE_DIRS = new Set(["discover", "space", "flow"]);

  const stepFiles = allFiles
    .filter((f) => {
      const name = basename(f);
      const dir = dirname(f);
      if (name === "master_prompt.md") return false;
      if (dir.includes("resources")) return false;
      if (!isTextFile(f)) return false;
      const hasStepPrefix = /^\d+[_-]/.test(name);
      const isInPhaseDir = PHASE_DIRS.has(dir);
      const isRootMd = dir === "." && name.endsWith(".md");
      return hasStepPrefix || isInPhaseDir || isRootMd;
    })
    .sort((a, b) => {
      const aDir = dirname(a);
      const bDir = dirname(b);
      const phaseOrder = ["discover", "space", "flow"];
      const ai = phaseOrder.indexOf(aDir);
      const bi = phaseOrder.indexOf(bDir);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      const aNum = parseInt(basename(a).match(/^(\d+)/)?.[1] ?? "999");
      const bNum = parseInt(basename(b).match(/^(\d+)/)?.[1] ?? "999");
      if (aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });

  const steps: WorkflowStep[] = [];
  const stepEntries: PromptEntry[] = [];

  stepFiles.forEach((relFile, i) => {
    const fullPath = join(dirPath, relFile);
    const stepNumber = i + 1;
    const stepId = `${workflowId}-step-${stepNumber}`;
    const stepTitle = titleFromFilename(relFile);
    steps.push({ stepNumber, id: stepId, title: stepTitle, filePath: fullPath });

    stepEntries.push(
      makePromptEntry(fullPath, "workflow", workflowId, {
        id: stepId,
        title: stepTitle,
        fileType: "workflow-step",
        workflowId,
        stepNumber,
      })
    );
  });

  const workflow: WorkflowEntry = {
    id: workflowId,
    title,
    category: "workflow",
    tags,
    description,
    dirPath,
    masterPromptPath: masterPath,
    steps,
  };

  const masterEntry: PromptEntry | undefined = masterPath
    ? makePromptEntry(masterPath, "workflow", workflowId, {
        id: `${workflowId}-master`,
        title: `${title} — Master Prompt`,
        fileType: "workflow",
        workflowId,
      })
    : undefined;

  return {
    workflow,
    steps: masterEntry ? [masterEntry, ...stepEntries] : stepEntries,
  };
}

async function scanImagePrompts(): Promise<PromptEntry[]> {
  const veoDir = join(REPO_ROOT, "image_prompts", "veo", "prompts");
  const entries: PromptEntry[] = [];
  let files: string[] = [];
  try {
    files = await glob("*.json", { cwd: veoDir });
  } catch {
    return entries;
  }
  for (const file of files) {
    const fullPath = join(veoDir, file);
    const raw = readFileSafe(fullPath);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }
    const productName = String(parsed.product_name ?? titleFromFilename(file));
    const id = `image-${slugify(productName)}`;
    const description = String(
      parsed.description ?? `Image/video generation prompt for ${productName}`
    ).slice(0, 150);
    const tags = [
      "image",
      "video",
      "product",
      String(parsed.product_type ?? "").toLowerCase(),
      ...(Array.isArray(parsed.keywords)
        ? (parsed.keywords as string[]).slice(0, 3)
        : []),
    ].filter(Boolean);

    entries.push({
      id,
      title: `${productName} — Image Prompt`,
      category: "image-prompt",
      tags,
      description,
      variables: [],
      filePath: fullPath,
      fileType: "image-prompt",
      mimeType: "application/json",
    });
  }
  return entries;
}

async function scanProjectFiles(): Promise<PromptEntry[]> {
  const projectsDir = join(REPO_ROOT, "projects");
  const entries: PromptEntry[] = [];
  let files: string[] = [];
  try {
    files = await glob("*", { cwd: projectsDir, nodir: true });
  } catch {
    return entries;
  }
  for (const file of files) {
    const fullPath = join(projectsDir, file);
    try {
      const stat = statSync(fullPath);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }
    const content = readFileSafe(fullPath);
    const title = file
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const id = `project-${slugify(title)}`;
    entries.push({
      id,
      title,
      category: "project",
      tags: inferTags(fullPath, content, "project"),
      description: inferDescription(content, title),
      variables: extractVariables(content),
      filePath: fullPath,
      fileType: "project",
      mimeType: "text/plain",
    });
  }
  return entries;
}

export async function buildManifest(): Promise<Manifest> {
  const allPrompts: PromptEntry[] = [];
  const allWorkflows: WorkflowEntry[] = [];

  const [marketing, sales, promotions, video, images, projects] =
    await Promise.all([
      scanFlatDirectory(join(REPO_ROOT, "marketing"), "marketing", "marketing"),
      scanFlatDirectory(join(REPO_ROOT, "sales"), "sales", "sales"),
      scanFlatDirectory(
        join(REPO_ROOT, "promotion_prompts_examples"),
        "promotion",
        "promotion"
      ),
      scanFlatDirectory(join(REPO_ROOT, "video_prompts"), "video", "video"),
      scanImagePrompts(),
      scanProjectFiles(),
    ]);

  allPrompts.push(...marketing, ...sales, ...promotions, ...video, ...images, ...projects);

  const rootPromptFiles = [
    "game_dev_idea_input_prompt.txt",
    "run_patent_trademark_analysis_prompt.txt",
  ];
  for (const f of rootPromptFiles) {
    const fullPath = join(REPO_ROOT, f);
    try {
      statSync(fullPath);
      allPrompts.push(makePromptEntry(fullPath, "general", "general"));
    } catch {
      // file doesn't exist, skip
    }
  }

  const workflowDirs = await glob("run_*/", {
    cwd: REPO_ROOT,
    mark: true,
  });

  for (const dir of workflowDirs) {
    const fullDir = join(REPO_ROOT, dir);
    const { workflow, steps } = await scanWorkflowDirectory(fullDir);
    allWorkflows.push(workflow);
    allPrompts.push(...steps);
  }

  const categories = Array.from(
    new Set(allPrompts.map((p) => p.category))
  ).sort();

  return {
    prompts: allPrompts,
    workflows: allWorkflows,
    categories,
    totalCount: allPrompts.length,
    lastIndexed: new Date().toISOString(),
  };
}

export function getPromptContent(entry: PromptEntry): string {
  return readFileSafe(entry.filePath);
}

export function resolveRepoPath(relPath: string): string {
  return join(REPO_ROOT, relPath);
}

export function getRelativePath(absPath: string): string {
  return relative(REPO_ROOT, absPath);
}
