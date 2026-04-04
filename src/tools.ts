import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Manifest, PromptEntry, WorkflowEntry } from "./types.js";
import { getPromptContent } from "./manifest.js";
import { searchPrompts, suggestPrompts } from "./utils/search.js";
import { fillTemplate } from "./utils/template.js";
import { classifyOnly, ingestPrompt, listIngestionCategories } from "./ingestion/ingester.js";
import type { WarehouseCatalog } from "./warehouse/types.js";
import type { AgentRegistry } from "./agents/types.js";
import {
  searchWarehouse,
  getWarehouseItemById,
  getWarehouseItemContent,
  getBundle,
  listBundles,
  buildWarehouseCatalog,
  updateWarehouseItem,
  generateProductId,
} from "./warehouse/catalog.js";
import { listAgents, getAgentPersona, registerAgent } from "./agents/registry.js";
import { dispatch } from "./factory/generator.js";
import { createBundle } from "./factory/bundle_creator.js";
import { enrichInput } from "./enrichment/extractor.js";
import { fulfillOrder } from "./orders/fulfiller.js";
import { getOrder, listOrders } from "./orders/manager.js";
import {
  buildStorefrontCard,
  formatMsrp,
  formatX402Price,
  validateCommerceConfig,
} from "./commerce/config.js";

export function registerTools(
  server: McpServer,
  manifest: Manifest,
  catalog: WarehouseCatalog,
  registry: AgentRegistry
): void {
  // ── Tool 1: list_categories ──────────────────────────────────────────────
  server.registerTool(
    "list_categories",
    {
      title: "List Prompt Categories",
      description:
        "Returns all available prompt categories with counts. Use this first to understand what's available.",
    },
    async () => {
      const counts: Record<string, number> = {};
      for (const p of manifest.prompts) {
        counts[p.category] = (counts[p.category] ?? 0) + 1;
      }
      const categories = manifest.categories.map((cat) => ({
        name: cat,
        count: counts[cat] ?? 0,
        description: getCategoryDescription(cat),
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ categories, totalPrompts: manifest.totalCount }, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 2: list_prompts ─────────────────────────────────────────────────
  server.registerTool(
    "list_prompts",
    {
      title: "List Prompts",
      description:
        "Lists available prompts and workflows with optional filtering by category, type, or tags.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category (marketing, sales, workflow, image-prompt, project, promotion, video, general)"
          ),
        type: z
          .enum(["prompt", "workflow", "workflow-step", "image-prompt", "project"])
          .optional()
          .describe("Filter by file type"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Filter by tags (prompts must match at least one tag)"),
      },
    },
    async ({ category, type, tags }) => {
      let results = manifest.prompts;
      if (category) {
        results = results.filter((p) => p.category === category);
      }
      if (type) {
        results = results.filter((p) => p.fileType === type);
      }
      if (tags && tags.length > 0) {
        const filterTags = new Set(tags.map((t) => t.toLowerCase()));
        results = results.filter((p) =>
          p.tags.some((t) => filterTags.has(t.toLowerCase()))
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: results.length,
                prompts: results.map(summarizeEntry),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 3: list_workflows ───────────────────────────────────────────────
  server.registerTool(
    "list_workflows",
    {
      title: "List Workflows",
      description:
        "Lists all multi-step business workflows with step counts and descriptions.",
    },
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: manifest.workflows.length,
                workflows: manifest.workflows.map((w) => ({
                  id: w.id,
                  title: w.title,
                  description: w.description,
                  stepCount: w.steps.length,
                  tags: w.tags,
                  steps: w.steps.map((s) => ({
                    stepNumber: s.stepNumber,
                    id: s.id,
                    title: s.title,
                  })),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 4: search_prompts ───────────────────────────────────────────────
  server.registerTool(
    "search_prompts",
    {
      title: "Search Prompts",
      description:
        "Fuzzy search across all prompt titles, descriptions, tags, and categories. Returns ranked results with relevance scores.",
      inputSchema: {
        query: z.string().describe("Search query text"),
        category: z
          .string()
          .optional()
          .describe("Optionally restrict search to a specific category"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of results to return (default: 10)"),
      },
    },
    async ({ query, category, limit }) => {
      let pool = manifest.prompts;
      if (category) {
        pool = pool.filter((p) => p.category === category);
      }
      const results = searchPrompts(query, pool, limit ?? 10);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query,
                count: results.length,
                results: results.map((r) => ({
                  ...summarizeEntry(r.item),
                  relevanceScore: r.score,
                  excerpt: r.excerpt,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 5: get_prompt ───────────────────────────────────────────────────
  server.registerTool(
    "get_prompt",
    {
      title: "Get Prompt",
      description:
        "Retrieves the full content of a specific prompt by its ID. Use list_prompts or search_prompts first to find IDs.",
      inputSchema: {
        id: z.string().describe("The prompt ID (e.g. 'marketing-kaizen-mastermind')"),
      },
    },
    async ({ id }) => {
      const entry = manifest.prompts.find((p) => p.id === id);
      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Prompt not found: "${id}". Use list_prompts or search_prompts to find valid IDs.`,
            },
          ],
          isError: true,
        };
      }
      const content = getPromptContent(entry);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                metadata: summarizeEntry(entry),
                content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 6: get_workflow ─────────────────────────────────────────────────
  server.registerTool(
    "get_workflow",
    {
      title: "Get Workflow",
      description:
        "Retrieves a complete multi-step workflow including the master prompt and all step contents.",
      inputSchema: {
        id: z
          .string()
          .describe("The workflow ID (e.g. 'modumind-r2r', 'legal-tasks')"),
        include_steps: z
          .boolean()
          .optional()
          .describe("Whether to include full step content (default: true)"),
      },
    },
    async ({ id, include_steps }) => {
      const workflow = manifest.workflows.find((w) => w.id === id);
      if (!workflow) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Workflow not found: "${id}". Use list_workflows to find valid IDs.`,
            },
          ],
          isError: true,
        };
      }

      const masterEntry = workflow.masterPromptPath
        ? manifest.prompts.find((p) => p.filePath === workflow.masterPromptPath)
        : undefined;
      const masterContent = masterEntry ? getPromptContent(masterEntry) : undefined;

      const shouldIncludeSteps = include_steps !== false;
      const steps = shouldIncludeSteps
        ? workflow.steps.map((s) => {
            const stepEntry = manifest.prompts.find(
              (p) => p.filePath === s.filePath
            );
            return {
              stepNumber: s.stepNumber,
              id: s.id,
              title: s.title,
              content: stepEntry ? getPromptContent(stepEntry) : "",
            };
          })
        : workflow.steps.map((s) => ({
            stepNumber: s.stepNumber,
            id: s.id,
            title: s.title,
          }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: workflow.id,
                title: workflow.title,
                description: workflow.description,
                tags: workflow.tags,
                stepCount: workflow.steps.length,
                masterPrompt: masterContent,
                steps,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 7: get_workflow_step ─────────────────────────────────────────────
  server.registerTool(
    "get_workflow_step",
    {
      title: "Get Workflow Step",
      description:
        "Retrieves the content of a specific step within a workflow. Useful for progressing through multi-step processes one step at a time.",
      inputSchema: {
        workflow_id: z.string().describe("The workflow ID"),
        step: z
          .union([z.number(), z.string()])
          .describe("Step number (1-based integer) or step ID string"),
      },
    },
    async ({ workflow_id, step }) => {
      const workflow = manifest.workflows.find((w) => w.id === workflow_id);
      if (!workflow) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Workflow not found: "${workflow_id}". Use list_workflows to find valid IDs.`,
            },
          ],
          isError: true,
        };
      }

      const found =
        typeof step === "number"
          ? workflow.steps.find((s) => s.stepNumber === step)
          : workflow.steps.find(
              (s) => s.id === step || s.title.toLowerCase() === String(step).toLowerCase()
            );

      if (!found) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Step "${step}" not found in workflow "${workflow_id}". Valid steps: ${workflow.steps.map((s) => `${s.stepNumber}: ${s.title}`).join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const stepEntry = manifest.prompts.find((p) => p.filePath === found.filePath);
      const content = stepEntry ? getPromptContent(stepEntry) : "";
      const nextStep = workflow.steps.find(
        (s) => s.stepNumber === found.stepNumber + 1
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                workflowId: workflow_id,
                workflowTitle: workflow.title,
                stepNumber: found.stepNumber,
                stepId: found.id,
                title: found.title,
                totalSteps: workflow.steps.length,
                nextStep: nextStep
                  ? { stepNumber: nextStep.stepNumber, id: nextStep.id, title: nextStep.title }
                  : null,
                content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 8: fill_template ─────────────────────────────────────────────────
  server.registerTool(
    "fill_template",
    {
      title: "Fill Prompt Template",
      description:
        "Fills {{VariableName}} placeholders in a prompt with provided values. Returns the completed prompt ready to use.",
      inputSchema: {
        id: z.string().describe("The prompt ID containing template variables"),
        variables: z
          .record(z.string(), z.string())
          .describe("Object mapping variable names to their values"),
      },
    },
    async ({ id, variables }) => {
      const entry = manifest.prompts.find((p) => p.id === id);
      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Prompt not found: "${id}".`,
            },
          ],
          isError: true,
        };
      }
      const content = getPromptContent(entry);
      const { filled, unfilled } = fillTemplate(content, variables as Record<string, string>);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                promptId: id,
                title: entry.title,
                availableVariables: entry.variables,
                unfilledVariables: unfilled,
                filledPrompt: filled,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 9: suggest_prompts ───────────────────────────────────────────────
  server.registerTool(
    "suggest_prompts",
    {
      title: "Suggest Prompts",
      description:
        "Given a goal or task description, suggests the most relevant prompts and workflows. Great for discovery when you don't know what's available.",
      inputSchema: {
        goal: z
          .string()
          .describe(
            "Description of your goal, task, or business challenge (e.g. 'I want to write better sales copy')"
          ),
        limit: z
          .number()
          .optional()
          .describe("Maximum suggestions to return (default: 5)"),
      },
    },
    async ({ goal, limit }) => {
      const suggestions = suggestPrompts(goal, manifest.prompts, limit ?? 5);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                goal,
                suggestions: suggestions.map((s) => ({
                  ...summarizeEntry(s),
                  reason: s.reason,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 10: get_prompt_metadata ──────────────────────────────────────────
  server.registerTool(
    "get_prompt_metadata",
    {
      title: "Get Prompt Metadata",
      description:
        "Returns metadata for a prompt (title, category, tags, variables, description) without fetching full content. Useful for planning before retrieval.",
      inputSchema: {
        id: z.string().describe("The prompt ID"),
      },
    },
    async ({ id }) => {
      const entry = manifest.prompts.find((p) => p.id === id);
      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Prompt not found: "${id}".`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summarizeEntry(entry), null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 11: list_ingestion_categories ────────────────────────────────────
  server.registerTool(
    "list_ingestion_categories",
    {
      title: "List Ingestion Categories",
      description:
        "Returns the full category taxonomy with descriptions and example keywords. Use this to understand which category to target before calling classify_prompt or ingest_prompt.",
    },
    async () => {
      const categories = listIngestionCategories();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ categories }, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 12: classify_prompt ──────────────────────────────────────────────
  server.registerTool(
    "classify_prompt",
    {
      title: "Classify Prompt",
      description:
        "Dry-run classification of prompt or framework content. Returns the suggested category, confidence score, detected framework pattern, template variables, and reasoning. No files are written.",
      inputSchema: {
        content: z.string().describe("The prompt or framework content to classify"),
        filename: z
          .string()
          .optional()
          .describe("Optional filename hint (e.g. 'my_sales_prompt.md')"),
        title: z
          .string()
          .optional()
          .describe("Optional title hint to improve classification accuracy"),
        type: z
          .enum(["prompt", "framework", "workflow"])
          .optional()
          .describe(
            "Content type: 'prompt' for single prompts, 'framework' for reusable templates, 'workflow' for multi-step processes"
          ),
      },
    },
    async ({ content, filename, title, type }) => {
      const result = classifyOnly({ content, filename, title, type });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 13: ingest_prompt ────────────────────────────────────────────────
  server.registerTool(
    "ingest_prompt",
    {
      title: "Ingest Prompt",
      description:
        "Classifies and optionally saves a prompt or framework to the appropriate category directory. When save=true, the file is written to disk and will be available after the next server restart. Use classify_prompt first for a dry run.",
      inputSchema: {
        content: z.string().describe("The prompt or framework content to ingest"),
        filename: z
          .string()
          .optional()
          .describe("Desired filename (e.g. 'my_prompt.md'). Auto-generated if omitted."),
        title: z
          .string()
          .optional()
          .describe("Optional title to improve classification and filename generation"),
        type: z
          .enum(["prompt", "framework", "workflow"])
          .optional()
          .describe("Content type hint"),
        save: z
          .boolean()
          .optional()
          .describe(
            "Whether to write the file to disk (default: false). Set true to persist."
          ),
        overwrite: z
          .boolean()
          .optional()
          .describe(
            "Whether to overwrite an existing file with the same name (default: false). When false, a numeric suffix is appended."
          ),
      },
    },
    async ({ content, filename, title, type, save, overwrite }) => {
      const result = await ingestPrompt(
        { content, filename, title, type },
        { save: save ?? false, overwrite: overwrite ?? false }
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 14: browse_warehouse ─────────────────────────────────────────────
  server.registerTool(
    "browse_warehouse",
    {
      title: "Browse Warehouse",
      description:
        "Browse the asset warehouse. Filter by role, category, or status to find relevant assets. The warehouse contains commissioned prompts, workflows, image specs, agent configs, and bundles.",
      inputSchema: {
        role: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .optional()
          .describe("Filter assets relevant to a specific C-Suite role"),
        category: z
          .string()
          .optional()
          .describe("Filter by category or asset type (prompt, workflow, image-spec, agent-config, bundle)"),
        status: z
          .enum(["draft", "ready", "featured"])
          .optional()
          .describe("Filter by asset status (default: all statuses)"),
        query: z
          .string()
          .optional()
          .describe("Optional text search query"),
      },
    },
    async ({ role, category, status, query }) => {
      // Refresh catalog to pick up any new items
      const freshCatalog = buildWarehouseCatalog(manifest);
      const items = searchWarehouse(query, role, category, status);
      const bundles = freshCatalog.bundles.filter((b) => {
        if (role && !b.targetRoles.includes(role)) return false;
        return true;
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                totalItems: items.length,
                totalBundles: bundles.length,
                items: items.map((i) => ({
                  id: i.id,
                  type: i.type,
                  title: i.title,
                  description: i.description,
                  targetRoles: i.targetRoles,
                  useCase: i.useCase,
                  status: i.status,
                  tags: i.tags,
                  keywords: i.keywords ?? [],
                  variables: i.variables,
                  category: i.category,
                  commissionedAt: i.commissionedAt,
                  productId: i.productId ?? null,
                  msrp: i.msrp ?? null,
                  msrpDisplay: i.msrp !== undefined ? formatMsrp(i.msrp) : null,
                  isForSale: !!(i.commerce?.x402?.enabled || i.commerce?.creem || i.commerce?.polar),
                })),
                bundles: bundles.map((b) => ({
                  id: b.id,
                  title: b.title,
                  description: b.description,
                  theme: b.theme,
                  targetRoles: b.targetRoles,
                  itemCount: b.itemIds.length,
                  createdAt: b.createdAt,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 15: get_warehouse_item ───────────────────────────────────────────
  server.registerTool(
    "get_warehouse_item",
    {
      title: "Get Warehouse Item",
      description:
        "Retrieves the full content of a specific warehouse asset by its ID. Use browse_warehouse to find IDs.",
      inputSchema: {
        id: z.string().describe("The warehouse item ID"),
      },
    },
    async ({ id }) => {
      const item = getWarehouseItemById(id);
      if (!item) {
        return {
          content: [{ type: "text" as const, text: `Warehouse item not found: "${id}". Use browse_warehouse to find valid IDs.` }],
          isError: true,
        };
      }
      const content = getWarehouseItemContent(item);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ metadata: item, content }, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 16: get_bundle ───────────────────────────────────────────────────
  server.registerTool(
    "get_bundle",
    {
      title: "Get Bundle",
      description:
        "Returns all assets in a named warehouse bundle, including both warehouse items and library prompts.",
      inputSchema: {
        id: z.string().describe("The bundle ID (from browse_warehouse or commission_bundle)"),
      },
    },
    async ({ id }) => {
      const bundle = getBundle(id);
      if (!bundle) {
        const allBundles = listBundles();
        return {
          content: [
            {
              type: "text" as const,
              text: `Bundle not found: "${id}". Available bundles: ${allBundles.map((b) => b.id).join(", ") || "none yet"}`,
            },
          ],
          isError: true,
        };
      }

      const warehouseItems = bundle.itemIds
        .map((itemId) => getWarehouseItemById(itemId))
        .filter(Boolean);

      const manifestItems = bundle.itemIds
        .map((itemId) => manifest.prompts.find((p) => p.id === itemId))
        .filter(Boolean);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                bundle,
                warehouseItems: warehouseItems.map((i) => ({
                  id: i!.id,
                  type: i!.type,
                  title: i!.title,
                  description: i!.description,
                  filePath: i!.filePath,
                })),
                libraryItems: manifestItems.map((p) => summarizeEntry(p!)),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 17: list_agents ──────────────────────────────────────────────────
  server.registerTool(
    "list_agents",
    {
      title: "List C-Suite Agents",
      description:
        "Lists all registered C-Suite agent personas with their roles, preferences, and default workflows.",
    },
    async () => {
      const agents = listAgents();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: agents.length,
                agents: agents.map((a) => ({
                  role: a.role,
                  displayName: a.displayName,
                  description: a.description,
                  preferredCategories: a.preferredCategories,
                  defaultWorkflows: a.defaultWorkflows,
                  toolPermissions: a.toolPermissions,
                  orderingPatternCount: a.orderingPatterns.length,
                  exampleOrders: a.orderingPatterns.slice(0, 2),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 18: get_agent ────────────────────────────────────────────────────
  server.registerTool(
    "get_agent",
    {
      title: "Get Agent Persona",
      description:
        "Returns the full persona definition for a C-Suite agent role, including system prompt and ordering patterns.",
      inputSchema: {
        role: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .describe("The agent role to retrieve"),
      },
    },
    async ({ role }) => {
      const persona = getAgentPersona(role);
      if (!persona) {
        return {
          content: [{ type: "text" as const, text: `Agent not found: "${role}". Use list_agents to see available roles.` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(persona, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 19: register_agent ───────────────────────────────────────────────
  server.registerTool(
    "register_agent",
    {
      title: "Register Custom Agent",
      description:
        "Creates a new custom agent persona file in the agents/ directory. Use this to define specialized sub-agents beyond the default C-Suite roles.",
      inputSchema: {
        role: z.string().describe("Unique role identifier (e.g. 'growth_hacker', 'data_scientist')"),
        displayName: z.string().describe("Human-readable name (e.g. 'Growth Hacker')"),
        description: z.string().describe("One-line description of the agent's mandate"),
        systemPrompt: z.string().describe("The agent's system prompt — their operating instructions"),
        preferredCategories: z
          .array(z.string())
          .optional()
          .describe("Categories this agent prefers (marketing, sales, workflow, etc.)"),
        defaultWorkflows: z
          .array(z.string())
          .optional()
          .describe("Workflow IDs this agent uses by default"),
        orderingPatterns: z
          .array(z.string())
          .optional()
          .describe("Example natural-language order patterns for this agent"),
      },
    },
    async ({ role, displayName, description, systemPrompt, preferredCategories, defaultWorkflows, orderingPatterns }) => {
      const filePath = registerAgent({
        role: role as import("./agents/types.js").CsuiteRole,
        displayName,
        description,
        systemPrompt,
        preferredCategories: preferredCategories ?? [],
        defaultWorkflows: defaultWorkflows ?? [],
        toolPermissions: [],
        orderingPatterns: orderingPatterns ?? [],
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, role, filePath, message: `Agent "${displayName}" registered at ${filePath}` }, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 20: commission_prompt ────────────────────────────────────────────
  server.registerTool(
    "commission_prompt",
    {
      title: "Commission Prompt",
      description:
        "Generates a new structured prompt asset using the Asset Factory. Produces a polished prompt with {{Variables}}, output format, and role-specific framing. Optionally saves to the warehouse.",
      inputSchema: {
        topic: z.string().describe("The prompt topic or title (e.g. 'B2B Sales Outreach Strategy')"),
        goal: z.string().describe("What the prompt should help achieve (e.g. 'Generate personalized cold email sequences')"),
        audience: z
          .string()
          .optional()
          .describe("Who will use this prompt (e.g. 'VP of Sales', 'startup founders')"),
        style: z
          .string()
          .optional()
          .describe("Tone and style (e.g. 'concise and direct', 'conversational and friendly')"),
        framework: z
          .enum(["dsf", "rcrc", "kaizen", "alchemist", "custom"])
          .optional()
          .describe("Optional framework to apply to structure the prompt"),
        context: z
          .string()
          .optional()
          .describe("Additional context or constraints for the prompt"),
        requested_by: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .optional()
          .describe("The C-Suite role commissioning this prompt"),
        save: z
          .boolean()
          .optional()
          .describe("Whether to save the prompt to the warehouse (default: false)"),
        product_id: z
          .string()
          .optional()
          .describe("Optional product SKU — auto-generated if omitted"),
        msrp: z
          .number()
          .optional()
          .describe("Optional retail price in USD cents (e.g. 99 = $0.99). Set to 0 for free."),
        keywords: z
          .array(z.string())
          .optional()
          .describe("Optional customer-facing search keywords"),
      },
    },
    async ({ topic, goal, audience, style, framework, context, requested_by, save, product_id, msrp, keywords }) => {
      const result = await dispatch({
        requestedBy: requested_by,
        assetSpec: { type: "prompt", topic, goal, audience, style, framework, context },
        save: save ?? false,
      });

      // Apply commerce fields to the saved item if provided
      if (result.saved && result.warehouseId && (product_id !== undefined || msrp !== undefined || keywords !== undefined)) {
        const resolvedProductId = product_id ?? generateProductId("prompt", topic);
        updateWarehouseItem(result.warehouseId, {
          productId: resolvedProductId,
          ...(msrp !== undefined ? { msrp } : {}),
          ...(keywords !== undefined ? { keywords } : {}),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                topic,
                goal,
                saved: result.saved,
                warehouseId: result.warehouseId,
                filePath: result.filePath,
                estimatedQuality: result.draft.estimatedQuality,
                variables: result.draft.variables,
                suggestedFilename: result.draft.suggestedFilename,
                content: result.draft.content,
                ...(msrp !== undefined ? { msrp, msrpDisplay: formatMsrp(msrp) } : {}),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 21: commission_workflow ──────────────────────────────────────────
  server.registerTool(
    "commission_workflow",
    {
      title: "Commission Workflow",
      description:
        "Generates a complete multi-step workflow using the Asset Factory. Creates a master prompt and all step files using the chosen framework (DSF, RCRC, Kaizen, Alchemist). Optionally saves to the warehouse.",
      inputSchema: {
        topic: z.string().describe("The workflow topic (e.g. 'Enterprise SaaS Sales Process')"),
        goal: z.string().describe("What the workflow achieves (e.g. 'Take a prospect from cold contact to signed contract')"),
        framework: z
          .enum(["dsf", "rcrc", "kaizen", "alchemist", "custom"])
          .optional()
          .describe("Framework to use (auto-detected from goal if not specified)"),
        steps: z
          .array(z.string())
          .optional()
          .describe("Custom step titles (auto-generated from framework if not provided)"),
        audience: z
          .string()
          .optional()
          .describe("Who will run this workflow"),
        context: z
          .string()
          .optional()
          .describe("Business context or constraints"),
        requested_by: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .optional()
          .describe("The C-Suite role commissioning this workflow"),
        save: z
          .boolean()
          .optional()
          .describe("Whether to save the workflow to the warehouse (default: false)"),
        product_id: z
          .string()
          .optional()
          .describe("Optional product SKU — auto-generated if omitted"),
        msrp: z
          .number()
          .optional()
          .describe("Optional retail price in USD cents (e.g. 2900 = $29.00). Set to 0 for free."),
        keywords: z
          .array(z.string())
          .optional()
          .describe("Optional customer-facing search keywords"),
      },
    },
    async ({ topic, goal, framework, steps, audience, context, requested_by, save, product_id, msrp, keywords }) => {
      const result = await dispatch({
        requestedBy: requested_by,
        assetSpec: { type: "workflow", topic, goal, audience, framework, steps, context },
        save: save ?? false,
      });

      // Apply commerce fields to the saved item if provided
      if (result.saved && result.warehouseId && (product_id !== undefined || msrp !== undefined || keywords !== undefined)) {
        const resolvedProductId = product_id ?? generateProductId("workflow", topic);
        updateWarehouseItem(result.warehouseId, {
          productId: resolvedProductId,
          ...(msrp !== undefined ? { msrp } : {}),
          ...(keywords !== undefined ? { keywords } : {}),
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                topic,
                goal,
                saved: result.saved,
                warehouseId: result.warehouseId,
                filePath: result.filePath,
                stepCount: result.additionalFiles ? result.additionalFiles.length + 1 : result.draft.variables.length,
                estimatedQuality: result.draft.estimatedQuality,
                content: result.draft.content.slice(0, 2000) + (result.draft.content.length > 2000 ? "\n\n...[truncated — use get_warehouse_item to see full content]" : ""),
                ...(msrp !== undefined ? { msrp, msrpDisplay: formatMsrp(msrp) } : {}),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 22: commission_bundle ────────────────────────────────────────────
  server.registerTool(
    "commission_bundle",
    {
      title: "Commission Bundle",
      description:
        "Creates a coordinated asset bundle for a theme and set of C-Suite roles. Searches existing warehouse + library for relevant assets, identifies gaps, and packages everything into a named bundle.",
      inputSchema: {
        theme: z.string().describe("The bundle theme (e.g. 'SaaS Product Launch', 'Enterprise Sales Playbook')"),
        goal: z.string().describe("What this bundle helps achieve"),
        roles: z
          .array(z.enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"]))
          .describe("Which C-Suite roles this bundle serves"),
        context: z
          .string()
          .optional()
          .describe("Additional context about the business or situation"),
      },
    },
    async ({ theme, goal, roles, context }) => {
      const result = createBundle({ theme, goal, roles, context }, manifest);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                bundleId: result.bundle.id,
                title: result.bundle.title,
                theme,
                goal,
                targetRoles: roles,
                totalAssets: result.bundle.itemIds.length,
                warehouseItemsFound: result.foundItems.length,
                libraryAssetsFound: result.manifestMatches.length,
                gaps: result.gaps,
                nextSteps:
                  result.gaps.length > 0
                    ? result.gaps.map((g) => `Use commission_prompt or commission_workflow to create: ${g}`)
                    : ["Bundle is fully covered — use get_bundle to access all assets"],
                bundleManifest: result.draft.content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 23: enrich_input ─────────────────────────────────────────────────
  server.registerTool(
    "enrich_input",
    {
      title: "Enrich Input",
      description:
        "Accepts raw input of any type (URL, text, transcript, or file content) and extracts structured information: title, topics, key entities, and suggested asset types to generate.",
      inputSchema: {
        type: z
          .enum(["url", "file", "text", "transcript"])
          .describe("Type of input being provided"),
        payload: z
          .string()
          .describe("The raw content — URL string, plain text, transcript, or file content"),
        context: z
          .string()
          .optional()
          .describe("Optional additional context about what you want to do with this input"),
      },
    },
    async ({ type, payload, context }) => {
      const result = await enrichInput({ type, payload, context });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 24: create_order ─────────────────────────────────────────────────
  server.registerTool(
    "create_order",
    {
      title: "Create Order",
      description:
        "C-Suite agents use this to order assets from the warehouse. Provide your role, intent, and urgency. The system searches existing assets and identifies gaps that need to be commissioned.",
      inputSchema: {
        role: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .describe("Your C-Suite role"),
        intent: z
          .string()
          .describe("What you need — describe your goal or request in natural language (e.g. 'I need a complete go-to-market launch bundle for a SaaS product targeting enterprise')"),
        urgency: z
          .enum(["low", "normal", "high"])
          .optional()
          .describe("Order urgency (default: normal)"),
      },
    },
    async ({ role, intent, urgency }) => {
      const fulfillment = await fulfillOrder(role, intent, manifest, urgency);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(fulfillment, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 25: get_order ────────────────────────────────────────────────────
  server.registerTool(
    "get_order",
    {
      title: "Get Order",
      description:
        "Retrieve the status and details of a specific order by its ID.",
      inputSchema: {
        order_id: z.string().describe("The order ID returned from create_order"),
      },
    },
    async ({ order_id }) => {
      const order = getOrder(order_id);
      if (!order) {
        return {
          content: [{ type: "text" as const, text: `Order not found: "${order_id}". Use list_orders to see your orders.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(order, null, 2) }],
      };
    }
  );

  // ── Tool 26: list_orders ──────────────────────────────────────────────────
  server.registerTool(
    "list_orders",
    {
      title: "List Orders",
      description:
        "Lists all orders, optionally filtered by C-Suite role.",
      inputSchema: {
        role: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .optional()
          .describe("Filter orders by role"),
      },
    },
    async ({ role }) => {
      const orders = listOrders(role);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ count: orders.length, orders }, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool 27: set_item_pricing ─────────────────────────────────────────────
  server.registerTool(
    "set_item_pricing",
    {
      title: "Set Item Pricing & Commerce Config",
      description:
        "Configure pricing, product ID, keywords, and payment options (x402, Creem, Polar, Mercury) for any warehouse item. Makes the item customer-facing.",
      inputSchema: {
        id: z.string().describe("The warehouse item ID to configure"),
        product_id: z
          .string()
          .optional()
          .describe("Unique product SKU (auto-generated if omitted)"),
        msrp: z
          .number()
          .optional()
          .describe("MSRP in USD cents (e.g. 99 = $0.99, 2900 = $29.00, 0 = free)"),
        keywords: z
          .array(z.string())
          .optional()
          .describe("Search keywords for customer-facing discovery (broader than tags)"),
        x402: z
          .object({
            enabled: z.boolean().describe("Whether to gate this item behind an x402 paywall"),
            price: z.number().describe("Price in smallest token units (e.g. 1000000 = 1 USDC)"),
            asset: z.string().describe("Payment asset symbol or contract address (e.g. 'USDC', 'ETH')"),
            network: z
              .enum(["base", "base-sepolia", "ethereum", "polygon", "solana", "optimism", "arbitrum"])
              .describe("Blockchain network for settlement"),
            pay_to: z.string().describe("Wallet address to receive payment"),
            payment_type: z
              .enum(["per-access", "per-request", "one-time", "subscription"])
              .optional()
              .describe("Payment model (default: per-access)"),
            facilitator_url: z
              .string()
              .optional()
              .describe("Optional facilitator URL (defaults to Coinbase x402 facilitator)"),
            payment_description: z
              .string()
              .optional()
              .describe("Human-readable description shown in the 402 response"),
          })
          .optional()
          .describe("x402 HTTP payment protocol configuration for agentic/API access"),
        creem: z
          .object({
            product_id: z.string().describe("Creem product ID from the Creem dashboard"),
            price_usd_cents: z.number().describe("Price in USD cents"),
            checkout_url: z.string().optional().describe("Creem checkout URL"),
            checkout_type: z
              .enum(["one_time", "recurring", "usage_based"])
              .optional()
              .describe("Checkout type (default: one_time)"),
            webhook_path: z.string().optional().describe("Webhook path for purchase notifications"),
            auto_fulfill: z.boolean().optional().describe("Auto-deliver on purchase webhook"),
          })
          .optional()
          .describe("Creem.io fiat checkout configuration"),
        polar: z
          .object({
            organization_slug: z.string().describe("Polar organization slug (e.g. '371-minds')"),
            product_id: z.string().describe("Polar product ID"),
            price_usd_cents: z.number().optional().describe("Price in USD cents (omit if free)"),
            is_free: z.boolean().optional().describe("Whether this is a free/open-access tier"),
            checkout_url: z.string().optional().describe("Polar checkout URL"),
            benefit_type: z
              .enum(["file_download", "license_keys", "custom", "discord_roles"])
              .optional()
              .describe("Type of benefit the buyer receives (default: file_download)"),
            webhook_path: z.string().optional().describe("Webhook path for purchase notifications"),
          })
          .optional()
          .describe("Polar.sh OSS monetization configuration"),
        mercury: z
          .object({
            api_key_env_var: z
              .string()
              .describe("Name of the environment variable holding the Mercury API key (e.g. 'MERCURY_API_KEY')"),
            account_id: z.string().optional().describe("Mercury account ID"),
            account_label: z.string().optional().describe("Human-readable account label"),
          })
          .optional()
          .describe("Mercury Bank treasury routing configuration"),
      },
    },
    async ({ id, product_id, msrp, keywords, x402, creem, polar, mercury }) => {
      const item = getWarehouseItemById(id);
      if (!item) {
        return {
          content: [{ type: "text" as const, text: `Warehouse item not found: "${id}". Use browse_warehouse to find valid IDs.` }],
          isError: true,
        };
      }

      // Build commerce config from inputs
      const commerce: import("./warehouse/types.js").WarehouseItem["commerce"] = { ...item.commerce };

      if (x402) {
        commerce.x402 = {
          enabled: x402.enabled,
          price: x402.price,
          asset: x402.asset,
          network: x402.network,
          payTo: x402.pay_to,
          paymentType: x402.payment_type ?? "per-access",
          facilitatorUrl: x402.facilitator_url,
          paymentDescription: x402.payment_description,
        };
      }

      if (creem) {
        commerce.creem = {
          apiKeyEnvVar: "CREEM_API_KEY",
          productId: creem.product_id,
          priceUsdCents: creem.price_usd_cents,
          checkoutUrl: creem.checkout_url,
          checkoutType: creem.checkout_type ?? "one_time",
          webhookPath: creem.webhook_path,
          autoFulfill: creem.auto_fulfill,
        };
      }

      if (polar) {
        commerce.polar = {
          apiKeyEnvVar: "POLAR_API_KEY",
          organizationSlug: polar.organization_slug,
          productId: polar.product_id,
          priceUsdCents: polar.price_usd_cents ?? 0,
          isFree: polar.is_free,
          checkoutUrl: polar.checkout_url,
          benefitType: polar.benefit_type ?? "file_download",
          webhookPath: polar.webhook_path,
        };
      }

      if (mercury) {
        commerce.mercury = {
          apiKeyEnvVar: mercury.api_key_env_var,
          accountId: mercury.account_id,
          accountLabel: mercury.account_label,
        };
      }

      // Validate commerce config
      const errors = validateCommerceConfig(commerce);
      if (errors.length > 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: false, errors }, null, 2) }],
          isError: true,
        };
      }

      // Generate product ID if not provided
      const resolvedProductId =
        product_id ?? item.productId ?? generateProductId(item.type, item.title);

      const updates: Partial<import("./warehouse/types.js").WarehouseItem> = {
        productId: resolvedProductId,
        commerce: Object.keys(commerce).length > 0 ? commerce : undefined,
      };
      if (msrp !== undefined) updates.msrp = msrp;
      if (keywords !== undefined) updates.keywords = keywords;

      const updated = updateWarehouseItem(id, updates);

      if (!updated) {
        return {
          content: [{ type: "text" as const, text: `Failed to update item "${id}".` }],
          isError: true,
        };
      }

      const freshItem = getWarehouseItemById(id)!;
      const storefrontCard = buildStorefrontCard({
        ...freshItem,
        productId: freshItem.productId,
        msrp: freshItem.msrp,
        keywords: freshItem.keywords,
        commerce: freshItem.commerce,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                id,
                productId: resolvedProductId,
                msrp: freshItem.msrp,
                msrpDisplay: freshItem.msrp !== undefined ? formatMsrp(freshItem.msrp) : null,
                keywords: freshItem.keywords ?? [],
                commerceEnabled: storefrontCard["commerceEnabled"],
                paymentOptions: storefrontCard["paymentOptions"],
                storefrontCard,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool 28: get_item_pricing ─────────────────────────────────────────────
  server.registerTool(
    "get_item_pricing",
    {
      title: "Get Item Pricing & Commerce Config",
      description:
        "Retrieve the full pricing, product ID, keywords, and payment configuration for a warehouse item. Also returns a ready-to-use storefront card.",
      inputSchema: {
        id: z.string().describe("The warehouse item ID"),
      },
    },
    async ({ id }) => {
      const item = getWarehouseItemById(id);
      if (!item) {
        return {
          content: [{ type: "text" as const, text: `Warehouse item not found: "${id}". Use browse_warehouse to find valid IDs.` }],
          isError: true,
        };
      }

      const storefrontCard = buildStorefrontCard({
        id: item.id,
        title: item.title,
        description: item.description,
        productId: item.productId,
        msrp: item.msrp,
        keywords: item.keywords,
        tags: item.tags,
        type: item.type,
        commerce: item.commerce,
      });

      // Build x402 payment-required header preview if configured
      let x402HeaderPreview: string | null = null;
      if (item.commerce?.x402?.enabled) {
        const { buildX402PaymentRequiredHeader } = await import("./commerce/config.js");
        x402HeaderPreview = buildX402PaymentRequiredHeader(item.commerce.x402);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: item.id,
                productId: item.productId ?? null,
                msrp: item.msrp ?? null,
                msrpDisplay: item.msrp !== undefined ? formatMsrp(item.msrp) : null,
                keywords: item.keywords ?? [],
                commerce: item.commerce ?? null,
                storefrontCard,
                x402HeaderPreview,
                integrationNotes: {
                  x402: item.commerce?.x402?.enabled
                    ? `Set HTTP header X-PAYMENT-REQUIRED: ${x402HeaderPreview?.slice(0, 40)}... on 402 responses. Facilitator: ${item.commerce.x402.facilitatorUrl ?? "https://x402.org/facilitator"}`
                    : "Not configured — use set_item_pricing to enable",
                  creem: item.commerce?.creem
                    ? `Checkout URL: ${item.commerce.creem.checkoutUrl ?? "not set"}. Requires CREEM_API_KEY env var.`
                    : "Not configured",
                  polar: item.commerce?.polar
                    ? `Product: ${item.commerce.polar.organizationSlug}/${item.commerce.polar.productId}. Requires POLAR_API_KEY env var.`
                    : "Not configured",
                  mercury: item.commerce?.mercury
                    ? `Treasury: ${item.commerce.mercury.accountLabel ?? item.commerce.mercury.accountId ?? "configured"}. Requires ${item.commerce.mercury.apiKeyEnvVar} env var.`
                    : "Not configured",
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

function summarizeEntry(
  entry: PromptEntry
): Record<string, unknown> {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    type: entry.fileType,
    description: entry.description,
    tags: entry.tags,
    variables: entry.variables,
    workflowId: entry.workflowId,
    stepNumber: entry.stepNumber,
  };
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    marketing: "Marketing strategy, growth, and brand prompts",
    sales: "Sales techniques, copywriting, and conversion prompts",
    workflow: "Multi-step business workflow frameworks",
    "image-prompt": "Structured prompts for AI image and video generation",
    project: "Startup and project idea blueprints",
    promotion: "Promotional copy and marketing examples",
    video: "Video content and thumbnail generation prompts",
    general: "General-purpose business prompts",
  };
  return descriptions[category] ?? category;
}
