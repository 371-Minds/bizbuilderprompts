import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Manifest, PromptEntry, WorkflowEntry } from "./types.js";
import { getPromptContent } from "./manifest.js";
import { searchPrompts, suggestPrompts } from "./utils/search.js";
import { fillTemplate } from "./utils/template.js";
import { classifyOnly, ingestPrompt, listIngestionCategories } from "./ingestion/ingester.js";

export function registerTools(server: McpServer, manifest: Manifest): void {
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
