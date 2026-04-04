import type { OrderFulfillment, OrderItem } from "./types.js";
import type { CsuiteRole } from "../agents/types.js";
import type { Manifest } from "../types.js";
import { createOrder, updateOrder } from "./manager.js";
import { searchWarehouse, getWarehouseCatalog } from "../warehouse/catalog.js";
import { searchPrompts } from "../utils/search.js";
import { getAgentPersona } from "../agents/registry.js";

const INTENT_ASSET_MAP: Array<{
  patterns: string[];
  assetTypes: string[];
}> = [
  { patterns: ["campaign", "launch", "marketing", "brand", "go-to-market", "gtm"], assetTypes: ["prompt", "workflow", "image-spec"] },
  { patterns: ["sales", "close", "prospect", "pitch", "outreach", "pipeline"], assetTypes: ["prompt", "workflow"] },
  { patterns: ["workflow", "process", "sop", "procedure", "step-by-step"], assetTypes: ["workflow"] },
  { patterns: ["image", "visual", "video", "photo", "graphic", "render"], assetTypes: ["image-spec"] },
  { patterns: ["strategy", "plan", "framework", "guide", "playbook"], assetTypes: ["prompt"] },
  { patterns: ["legal", "compliance", "contract", "ip", "patent"], assetTypes: ["prompt", "workflow"] },
  { patterns: ["financial", "tax", "budget", "forecast", "model"], assetTypes: ["prompt"] },
  { patterns: ["product", "roadmap", "feature", "user research"], assetTypes: ["prompt", "workflow"] },
  { patterns: ["agent", "bot", "assistant", "persona", "custom ai"], assetTypes: ["agent-config"] },
  { patterns: ["bundle", "pack", "kit", "collection", "set"], assetTypes: ["prompt", "workflow", "image-spec"] },
  { patterns: ["onboarding", "hire", "training", "team"], assetTypes: ["workflow", "prompt"] },
  { patterns: ["content", "copy", "email", "social media", "post"], assetTypes: ["prompt"] },
];

function parseAssetTypes(intent: string): string[] {
  const lower = intent.toLowerCase();
  const found = new Set<string>();

  for (const { patterns, assetTypes } of INTENT_ASSET_MAP) {
    if (patterns.some((p) => lower.includes(p))) {
      for (const t of assetTypes) found.add(t);
    }
  }

  if (found.size === 0) found.add("prompt");
  return Array.from(found);
}

function buildSuggestions(
  intent: string,
  role: CsuiteRole,
  gaps: string[]
): string[] {
  const suggestions: string[] = [];
  const persona = getAgentPersona(role);

  if (gaps.length > 0) {
    suggestions.push(
      `Use \`commission_prompt\` or \`commission_workflow\` to create: ${gaps.slice(0, 3).join(", ")}`
    );
  }

  if (persona?.defaultWorkflows?.length) {
    suggestions.push(
      `Your default workflows: ${persona.defaultWorkflows.join(", ")} — use \`get_workflow\` to run them`
    );
  }

  suggestions.push(
    `Use \`search_prompts\` with query "${intent.slice(0, 40)}" to find related library assets`,
    `Use \`commission_bundle\` to create a coordinated asset pack for this goal`
  );

  return suggestions.slice(0, 4);
}

/**
 * Fulfill an order by searching warehouse + manifest for matching assets.
 * Creates an order record and returns fulfillment details.
 */
export async function fulfillOrder(
  requestedBy: CsuiteRole,
  intent: string,
  manifest: Manifest,
  urgency?: "low" | "normal" | "high"
): Promise<OrderFulfillment> {
  // Parse intent into asset types
  const assetTypes = parseAssetTypes(intent);

  // Create the order record
  const order = createOrder(requestedBy, intent, assetTypes, urgency);

  const readyAssets: OrderItem[] = [];
  const pendingCommissions: OrderItem[] = [];

  // 1. Search warehouse for ready items
  const warehouseResults = searchWarehouse(intent, requestedBy);
  for (const item of warehouseResults.slice(0, 8)) {
    if (item.status === "ready" || item.status === "featured") {
      readyAssets.push({
        assetId: item.id,
        assetType: item.type,
        title: item.title,
        status: "found",
        filePath: item.filePath,
      });
    }
  }

  // 2. Search manifest (library assets)
  const manifestResults = searchPrompts(intent, manifest.prompts, 8);
  for (const result of manifestResults) {
    // Only add if not already covered
    const alreadyCovered = readyAssets.some(
      (r) => r.title.toLowerCase() === result.item.title.toLowerCase()
    );
    if (!alreadyCovered) {
      readyAssets.push({
        assetId: result.item.id,
        assetType: result.item.fileType,
        title: result.item.title,
        status: "found",
        filePath: result.item.filePath,
      });
    }
  }

  // 3. Check persona default workflows
  const persona = getAgentPersona(requestedBy);
  if (persona) {
    for (const wfId of persona.defaultWorkflows) {
      const workflow = manifest.workflows.find((w) => w.id === wfId);
      if (workflow && !readyAssets.some((r) => r.assetId === `${wfId}-master`)) {
        readyAssets.push({
          assetId: `${wfId}-master`,
          assetType: "workflow",
          title: workflow.title,
          status: "found",
          filePath: workflow.masterPromptPath ?? workflow.dirPath,
        });
      }
    }
  }

  // 4. Identify gaps — asset types requested but not found
  const gaps: string[] = [];
  for (const type of assetTypes) {
    const typeCovered = readyAssets.some((r) => r.assetType === type || r.assetType.includes(type));
    if (!typeCovered) {
      gaps.push(type);
      pendingCommissions.push({
        assetId: `pending-${type}-${Date.now().toString(36)}`,
        assetType: type,
        title: `[Pending] ${type} for: ${intent.slice(0, 60)}`,
        status: "pending",
      });
    }
  }

  // 5. Update order status
  const status = readyAssets.length > 0 && pendingCommissions.length === 0
    ? "fulfilled"
    : readyAssets.length > 0
    ? "partial"
    : "pending";

  updateOrder(order.id, { status });

  const suggestions = buildSuggestions(intent, requestedBy, gaps);

  return {
    orderId: order.id,
    status,
    readyAssets: readyAssets.slice(0, 10),
    pendingCommissions,
    suggestions,
  };
}
