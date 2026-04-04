import type { AssetSpec, AssetDraft } from "./types.js";
import type { CsuiteRole } from "../agents/types.js";
import type { WarehouseItem, Bundle } from "../warehouse/types.js";
import type { Manifest } from "../types.js";
import { getWarehouseCatalog, addBundle } from "../warehouse/catalog.js";
import { searchPrompts } from "../utils/search.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export interface BundleSpec {
  theme: string;
  goal: string;
  roles: CsuiteRole[];
  context?: string;
}

export interface BundleCreationResult {
  bundle: Bundle;
  foundItems: WarehouseItem[];
  manifestMatches: Array<{ id: string; title: string; category: string; filePath: string }>;
  gaps: string[];
  draft: AssetDraft;
}

const ROLE_ASSET_NEEDS: Record<CsuiteRole, string[]> = {
  ceo: ["strategic framework", "growth plan", "venture evaluation", "executive dashboard"],
  cmo: ["campaign strategy", "content calendar", "brand guidelines", "go-to-market plan"],
  cfo: ["financial model", "tax strategy", "due diligence checklist", "budget framework"],
  cto: ["technical architecture", "automation workflow", "AI integration", "engineering process"],
  vp_sales: ["sales playbook", "outreach sequence", "objection handling", "pipeline framework"],
  vp_product: ["product roadmap", "user research guide", "PRD template", "feature prioritization"],
  legal_counsel: ["compliance checklist", "contract template", "IP protection guide", "risk assessment"],
  head_of_ops: ["SOP template", "onboarding workflow", "process improvement", "automation blueprint"],
};

/**
 * Creates a bundle by searching for existing warehouse + manifest assets,
 * identifying gaps, and packaging everything into a named Bundle.
 */
export function createBundle(
  spec: BundleSpec,
  manifest: Manifest
): BundleCreationResult {
  const catalog = getWarehouseCatalog();
  const query = `${spec.theme} ${spec.goal}`;

  // 1. Search warehouse for relevant items
  const foundItems: WarehouseItem[] = catalog.items.filter((item) => {
    const text = `${item.title} ${item.description} ${item.tags.join(" ")} ${item.useCase}`.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);
    return queryTerms.some((term) => text.includes(term));
  });

  // Also include items targeted at the requested roles
  const roleItems = catalog.items.filter(
    (item) =>
      !foundItems.find((f) => f.id === item.id) &&
      spec.roles.some((r) => item.targetRoles.includes(r))
  );
  foundItems.push(...roleItems.slice(0, 5));

  // 2. Search manifest for relevant prompts/workflows
  const manifestMatches = searchPrompts(query, manifest.prompts, 8).map((r) => ({
    id: r.item.id,
    title: r.item.title,
    category: r.item.category,
    filePath: r.item.filePath,
  }));

  // Also include default workflows for the roles
  const roleWorkflowIds = new Set<string>();
  for (const role of spec.roles) {
    const defaults = getDefaultWorkflowsForRole(role);
    for (const wfId of defaults) roleWorkflowIds.add(wfId);
  }
  const additionalWorkflows = manifest.workflows
    .filter(
      (w) =>
        roleWorkflowIds.has(w.id) &&
        !manifestMatches.find((m) => m.id === `${w.id}-master`)
    )
    .map((w) => ({
      id: `${w.id}-master`,
      title: w.title,
      category: "workflow",
      filePath: w.masterPromptPath ?? w.dirPath,
    }));
  manifestMatches.push(...additionalWorkflows.slice(0, 3));

  // 3. Identify gaps — asset types each role needs that aren't covered
  const gaps: string[] = [];
  const coveredText = [
    ...foundItems.map((i) => `${i.title} ${i.tags.join(" ")}`),
    ...manifestMatches.map((m) => m.title),
  ].join(" ").toLowerCase();

  for (const role of spec.roles) {
    const needs = ROLE_ASSET_NEEDS[role] ?? [];
    for (const need of needs) {
      const needTerms = need.toLowerCase().split(" ");
      if (!needTerms.some((t) => coveredText.includes(t))) {
        gaps.push(`[${role}] ${need}`);
      }
    }
  }

  // 4. Build the bundle
  const bundleId = `bundle-${slugify(spec.theme)}-${Date.now().toString(36)}`;
  const allItemIds = [
    ...foundItems.map((i) => i.id),
    ...manifestMatches.map((m) => m.id),
  ];

  const bundle: Bundle = {
    id: bundleId,
    title: `${spec.theme} Bundle`,
    description: `Coordinated asset bundle for: ${spec.goal}. Includes ${allItemIds.length} assets targeting ${spec.roles.join(", ")} roles.`,
    theme: spec.theme,
    targetRoles: spec.roles,
    itemIds: [...new Set(allItemIds)],
    createdAt: new Date().toISOString(),
  };

  // Persist the bundle
  addBundle(bundle);

  // 5. Build the draft as a bundle manifest document
  const bundleManifestContent = buildBundleManifestDoc(spec, bundle, foundItems, manifestMatches, gaps);

  const draft: AssetDraft = {
    spec: {
      type: "asset-bundle",
      topic: spec.theme,
      goal: spec.goal,
      audience: spec.roles.join(", "),
      context: spec.context,
    },
    content: bundleManifestContent,
    suggestedFilename: `${bundleId}.json`,
    suggestedCategory: "bundle",
    variables: [],
    estimatedQuality: gaps.length === 0 ? "high" : gaps.length <= 3 ? "medium" : "low",
  };

  return { bundle, foundItems, manifestMatches, gaps, draft };
}

function getDefaultWorkflowsForRole(role: CsuiteRole): string[] {
  const defaults: Record<CsuiteRole, string[]> = {
    ceo: ["venture-forge", "dsf-playbook", "virtuous-flywheel"],
    cmo: ["viral-freeshare", "linkedin-tasks"],
    cfo: ["tax-free-service", "legal-tasks"],
    cto: ["googleaimode", "modumind-r2r"],
    vp_sales: ["venture-forge"],
    vp_product: ["dsf-playbook", "alchemist-apprenticeship"],
    legal_counsel: ["legal-tasks", "patent-tasks"],
    head_of_ops: ["async-onboarding-tasks", "async-rcrc"],
  };
  return defaults[role] ?? [];
}

function buildBundleManifestDoc(
  spec: BundleSpec,
  bundle: Bundle,
  foundItems: WarehouseItem[],
  manifestMatches: Array<{ id: string; title: string; category: string }>,
  gaps: string[]
): string {
  const lines: string[] = [
    `# Bundle: ${bundle.title}`,
    "",
    `**ID:** ${bundle.id}`,
    `**Theme:** ${spec.theme}`,
    `**Goal:** ${spec.goal}`,
    `**Target Roles:** ${spec.roles.join(", ")}`,
    `**Created:** ${bundle.createdAt}`,
    `**Total Assets:** ${bundle.itemIds.length}`,
    "",
    "---",
    "",
    "## Warehouse Assets",
    "",
    foundItems.length > 0
      ? foundItems.map((i) => `- [${i.type}] **${i.title}** — ${i.description.slice(0, 100)}`).join("\n")
      : "_No warehouse assets found — commission assets to populate this bundle._",
    "",
    "## Library Assets",
    "",
    manifestMatches.length > 0
      ? manifestMatches.map((m) => `- [${m.category}] **${m.title}** (ID: ${m.id})`).join("\n")
      : "_No library assets matched._",
    "",
    "## Identified Gaps",
    "",
    gaps.length > 0
      ? [
          "The following asset types are needed but not yet available:",
          "",
          ...gaps.map((g) => `- ${g}`),
          "",
          "Use `commission_prompt` or `commission_workflow` to create these assets.",
        ].join("\n")
      : "✅ All role requirements are covered by existing assets.",
    "",
    "---",
    "",
    "## How to Use This Bundle",
    "",
    "1. **Access library assets** via `get_prompt` with the IDs listed above",
    "2. **Fill templates** using `fill_template` with your business context",
    "3. **Run workflows** using `get_workflow` or the `run_workflow` prompt",
    "4. **Commission gaps** by calling `commission_prompt` or `commission_workflow`",
    "5. **Track progress** by updating asset statuses in the warehouse",
  ];

  return lines.join("\n");
}
