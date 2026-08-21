import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { CommissionRequest, FactoryResult, AssetSpec } from "./types.js";
import { craftPrompt } from "./prompt_crafter.js";
import { designWorkflow, writeWorkflowToDisk } from "./workflow_architect.js";
import { buildImageSpec } from "./image_spec_builder.js";
import {
  addToWarehouse,
  getWarehouseSubdir,
  WAREHOUSE_DIR,
} from "../warehouse/catalog.js";
import type { WarehouseItem } from "../warehouse/types.js";
import { extractVariables } from "../utils/template.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function generateWarehouseId(spec: AssetSpec): string {
  return `warehouse-${spec.type}-${slugify(spec.topic)}-${Date.now().toString(36)}`;
}

/** Dispatch a commission request to the appropriate factory module. */
export async function dispatch(request: CommissionRequest): Promise<FactoryResult> {
  const { assetSpec, save = false, requestedBy } = request;

  switch (assetSpec.type) {
    case "prompt":
    case "project-template":
      return commissionPrompt(assetSpec, save, requestedBy);

    case "workflow":
      return commissionWorkflow(assetSpec, save, requestedBy);

    case "image-spec":
      return commissionImageSpec(assetSpec, save, requestedBy);

    case "agent-config":
      return commissionAgentConfig(assetSpec, save, requestedBy);

    default:
      return commissionPrompt(assetSpec, save, requestedBy);
  }
}

async function commissionPrompt(
  spec: AssetSpec,
  save: boolean,
  requestedBy?: CommissionRequest["requestedBy"]
): Promise<FactoryResult> {
  const draft = craftPrompt(spec);

  if (!save) {
    return { draft, saved: false };
  }

  const subdir = getWarehouseSubdir("prompt");
  const filePath = join(subdir, draft.suggestedFilename);

  // Handle collisions
  const finalPath = resolveFilePath(filePath);
  writeFileSync(finalPath, draft.content, "utf-8");

  const warehouseId = generateWarehouseId(spec);
  const warehouseItem: WarehouseItem = {
    id: warehouseId,
    type: "prompt",
    title: spec.topic,
    description: spec.goal,
    targetRoles: requestedBy ? [requestedBy] : [],
    useCase: spec.goal,
    status: "draft",
    commissionedBy: requestedBy,
    commissionedAt: new Date().toISOString(),
    linkedItems: [],
    tags: [spec.type, ...(spec.framework ? [spec.framework] : []), ...(draft.suggestedCategory ? [draft.suggestedCategory] : [])],
    variables: extractVariables(draft.content),
    filePath: finalPath,
    category: draft.suggestedCategory,
  };

  addToWarehouse(warehouseItem);

  return {
    draft,
    saved: true,
    warehouseId,
    filePath: finalPath,
  };
}

async function commissionWorkflow(
  spec: AssetSpec,
  save: boolean,
  requestedBy?: CommissionRequest["requestedBy"]
): Promise<FactoryResult> {
  const design = designWorkflow(spec);

  if (!save) {
    return { draft: design.draft, saved: false };
  }

  const workflowBaseDir = join(WAREHOUSE_DIR, "workflows");
  if (!existsSync(workflowBaseDir)) {
    mkdirSync(workflowBaseDir, { recursive: true });
  }

  const writtenPaths = writeWorkflowToDisk(design, workflowBaseDir);
  const masterPath = writtenPaths[0];

  const warehouseId = generateWarehouseId(spec);
  const warehouseItem: WarehouseItem = {
    id: warehouseId,
    type: "workflow",
    title: `${spec.topic} — Workflow`,
    description: spec.goal,
    targetRoles: requestedBy ? [requestedBy] : [],
    useCase: spec.goal,
    status: "draft",
    commissionedBy: requestedBy,
    commissionedAt: new Date().toISOString(),
    linkedItems: [],
    tags: ["workflow", design.framework, spec.type],
    variables: ["Topic", "Goal", "Business Context", "Audience"],
    filePath: join(workflowBaseDir, design.dirName),
    category: "workflow",
  };

  addToWarehouse(warehouseItem);

  const additionalFiles = writtenPaths.slice(1).map((path, i) => ({
    path,
    content: design.steps[i]?.content ?? "",
  }));

  return {
    draft: design.draft,
    saved: true,
    warehouseId,
    filePath: masterPath,
    additionalFiles,
  };
}

async function commissionImageSpec(
  spec: AssetSpec,
  save: boolean,
  requestedBy?: CommissionRequest["requestedBy"]
): Promise<FactoryResult> {
  const draft = buildImageSpec(spec);

  if (!save) {
    return { draft, saved: false };
  }

  const subdir = getWarehouseSubdir("image-spec");
  const filePath = join(subdir, draft.suggestedFilename);
  const finalPath = resolveFilePath(filePath);
  writeFileSync(finalPath, draft.content, "utf-8");

  const warehouseId = generateWarehouseId(spec);
  const warehouseItem: WarehouseItem = {
    id: warehouseId,
    type: "image-spec",
    title: `${spec.topic} — Image Spec`,
    description: spec.goal,
    targetRoles: requestedBy ? [requestedBy] : [],
    useCase: spec.goal,
    status: "draft",
    commissionedBy: requestedBy,
    commissionedAt: new Date().toISOString(),
    linkedItems: [],
    tags: ["image-spec", "visual", ...(spec.style ? [spec.style] : [])],
    variables: draft.variables,
    filePath: finalPath,
    category: "image-prompt",
  };

  addToWarehouse(warehouseItem);

  return {
    draft,
    saved: true,
    warehouseId,
    filePath: finalPath,
  };
}

async function commissionAgentConfig(
  spec: AssetSpec,
  save: boolean,
  requestedBy?: CommissionRequest["requestedBy"]
): Promise<FactoryResult> {
  // Build an agent configuration document
  const content = buildAgentConfigContent(spec);
  const slug = slugify(spec.topic);

  const draft = {
    spec,
    content,
    suggestedFilename: `${slug}_agent.md`,
    suggestedCategory: "agent-config",
    variables: extractVariables(content),
    estimatedQuality: "medium" as const,
  };

  if (!save) {
    return { draft, saved: false };
  }

  const subdir = getWarehouseSubdir("agent-config");
  const filePath = join(subdir, draft.suggestedFilename);
  const finalPath = resolveFilePath(filePath);
  writeFileSync(finalPath, content, "utf-8");

  const warehouseId = generateWarehouseId(spec);
  const warehouseItem: WarehouseItem = {
    id: warehouseId,
    type: "agent-config",
    title: `${spec.topic} Agent`,
    description: spec.goal,
    targetRoles: requestedBy ? [requestedBy] : [],
    useCase: spec.goal,
    status: "draft",
    commissionedBy: requestedBy,
    commissionedAt: new Date().toISOString(),
    linkedItems: [],
    tags: ["agent", "config", "custom"],
    variables: draft.variables,
    filePath: finalPath,
    category: "agent-config",
  };

  addToWarehouse(warehouseItem);

  return {
    draft,
    saved: true,
    warehouseId,
    filePath: finalPath,
  };
}

function buildAgentConfigContent(spec: AssetSpec): string {
  return [
    `# ${spec.topic} Agent`,
    "",
    `> **Role:** ${spec.topic}`,
    `> **Goal:** ${spec.goal}`,
    spec.audience ? `> **Serves:** ${spec.audience}` : "",
    "",
    "---",
    "",
    "## System Prompt",
    "",
    `You are a specialized ${spec.topic} agent. Your primary mandate is: ${spec.goal}.`,
    "",
    spec.context ? `**Context:** ${spec.context}` : "",
    "",
    "## Capabilities",
    "",
    `- Expert knowledge in {{Domain}}`,
    `- Optimized for {{Primary Task}}`,
    `- Calibrated for {{Target Audience}}`,
    "",
    "## Operating Principles",
    "",
    "1. Always prioritize the stated goal: **{{Goal}}**",
    "2. Communicate in a style appropriate for: **{{Audience}}**",
    "3. Maintain context and continuity across interactions",
    "4. Escalate ambiguous decisions rather than guessing",
    "",
    "## Available Tools",
    "",
    `The ${spec.topic} agent has access to: {{Tool List}}`,
    "",
    "## Constraints",
    "",
    `- Scope: {{Scope Boundaries}}`,
    `- Tone: ${spec.style ?? "professional and precise"}`,
    "- Always disclose when operating outside core expertise",
  ].filter((l) => l !== undefined).join("\n");
}

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
