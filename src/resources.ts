import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Manifest, PromptEntry } from "./types.js";
import { getPromptContent, getRelativePath } from "./manifest.js";

/**
 * Registers MCP Resources for every prompt/workflow/image/project file.
 *
 * URI scheme:
 *   prompt://bizbuilderprompts/{category}/{id}
 *   workflow://bizbuilderprompts/{workflowId}
 *   workflow://bizbuilderprompts/{workflowId}/steps/{stepId}
 *   image-prompt://bizbuilderprompts/{id}
 *   project://bizbuilderprompts/{id}
 */
export function registerResources(server: McpServer, manifest: Manifest): void {
  // Index for fast lookup by URI
  const byUri = new Map<string, PromptEntry>();

  for (const entry of manifest.prompts) {
    const uri = entryToUri(entry);
    byUri.set(uri, entry);
  }

  // Register a dynamic resource template that covers all prompts
  const allUris = Array.from(byUri.keys());

  server.registerResource(
    "prompt-library",
    new ResourceTemplate("prompt://bizbuilderprompts/{category}/{id}", {
      list: async () => ({
        resources: allUris
          .filter((u) => u.startsWith("prompt://"))
          .map((uri) => {
            const entry = byUri.get(uri)!;
            return {
              uri,
              name: entry.title,
              description: entry.description,
              mimeType: entry.mimeType,
            };
          }),
      }),
    }),
    {
      title: "Business Prompt Library",
      description: "Access individual business prompts by category and ID",
    },
    async (uri) => {
      const entry = byUri.get(uri.href);
      if (!entry) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Prompt not found: ${uri.href}`,
              mimeType: "text/plain",
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: getPromptContent(entry),
            mimeType: entry.mimeType,
          },
        ],
      };
    }
  );

  // Workflow master prompts
  server.registerResource(
    "workflow-library",
    new ResourceTemplate("workflow://bizbuilderprompts/{workflowId}", {
      list: async () => ({
        resources: manifest.workflows.map((w) => ({
          uri: `workflow://bizbuilderprompts/${w.id}`,
          name: w.title,
          description: w.description,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "Business Workflow Library",
      description: "Access multi-step business workflow master prompts",
    },
    async (uri, { workflowId }) => {
      const workflow = manifest.workflows.find((w) => w.id === workflowId);
      if (!workflow) {
        return {
          contents: [
            { uri: uri.href, text: `Workflow not found: ${workflowId}`, mimeType: "text/plain" },
          ],
        };
      }

      if (!workflow.masterPromptPath) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Workflow "${workflow.title}" has no master prompt. It has ${workflow.steps.length} steps.`,
              mimeType: "text/plain",
            },
          ],
        };
      }

      const masterEntry = manifest.prompts.find(
        (p) => p.filePath === workflow.masterPromptPath
      );
      const content = masterEntry
        ? getPromptContent(masterEntry)
        : `# ${workflow.title}\n\nSteps: ${workflow.steps.map((s) => s.title).join(", ")}`;

      return {
        contents: [{ uri: uri.href, text: content, mimeType: "text/markdown" }],
      };
    }
  );

  // Individual workflow steps
  server.registerResource(
    "workflow-steps",
    new ResourceTemplate(
      "workflow://bizbuilderprompts/{workflowId}/steps/{stepId}",
      {
        list: async () => ({
          resources: manifest.workflows.flatMap((w) =>
            w.steps.map((s) => ({
              uri: `workflow://bizbuilderprompts/${w.id}/steps/${s.id}`,
              name: `${w.title} — ${s.title}`,
              description: `Step ${s.stepNumber} of ${w.title}`,
              mimeType: "text/markdown",
            }))
          ),
        }),
      }
    ),
    {
      title: "Workflow Step Content",
      description: "Access individual steps within a business workflow",
    },
    async (uri, { workflowId, stepId }) => {
      const workflow = manifest.workflows.find((w) => w.id === workflowId);
      const step = workflow?.steps.find((s) => s.id === stepId);
      if (!step) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Step not found: ${stepId} in workflow ${workflowId}`,
              mimeType: "text/plain",
            },
          ],
        };
      }
      const stepEntry = manifest.prompts.find((p) => p.filePath === step.filePath);
      const content = stepEntry ? getPromptContent(stepEntry) : "";
      return {
        contents: [{ uri: uri.href, text: content, mimeType: "text/markdown" }],
      };
    }
  );

  // Image prompts
  server.registerResource(
    "image-prompts",
    new ResourceTemplate("image-prompt://bizbuilderprompts/{id}", {
      list: async () => ({
        resources: manifest.prompts
          .filter((p) => p.fileType === "image-prompt")
          .map((p) => ({
            uri: `image-prompt://bizbuilderprompts/${p.id}`,
            name: p.title,
            description: p.description,
            mimeType: "application/json",
          })),
      }),
    }),
    {
      title: "Product Image & Video Prompts",
      description: "Structured JSON prompts for AI image and video generation",
    },
    async (uri, { id }) => {
      const entry = manifest.prompts.find(
        (p) => p.fileType === "image-prompt" && p.id === id
      );
      if (!entry) {
        return {
          contents: [
            { uri: uri.href, text: `Image prompt not found: ${id}`, mimeType: "text/plain" },
          ],
        };
      }
      return {
        contents: [
          { uri: uri.href, text: getPromptContent(entry), mimeType: "application/json" },
        ],
      };
    }
  );

  // Project templates
  server.registerResource(
    "project-templates",
    new ResourceTemplate("project://bizbuilderprompts/{id}", {
      list: async () => ({
        resources: manifest.prompts
          .filter((p) => p.fileType === "project")
          .map((p) => ({
            uri: `project://bizbuilderprompts/${p.id}`,
            name: p.title,
            description: p.description,
            mimeType: "text/plain",
          })),
      }),
    }),
    {
      title: "Project Idea Templates",
      description: "45+ startup and project idea blueprints",
    },
    async (uri, { id }) => {
      const entry = manifest.prompts.find(
        (p) => p.fileType === "project" && p.id === id
      );
      if (!entry) {
        return {
          contents: [
            { uri: uri.href, text: `Project template not found: ${id}`, mimeType: "text/plain" },
          ],
        };
      }
      return {
        contents: [
          { uri: uri.href, text: getPromptContent(entry), mimeType: "text/plain" },
        ],
      };
    }
  );
}

function entryToUri(entry: PromptEntry): string {
  switch (entry.fileType) {
    case "image-prompt":
      return `image-prompt://bizbuilderprompts/${entry.id}`;
    case "project":
      return `project://bizbuilderprompts/${entry.id}`;
    case "workflow":
    case "workflow-step":
      if (entry.fileType === "workflow-step" && entry.workflowId) {
        return `workflow://bizbuilderprompts/${entry.workflowId}/steps/${entry.id}`;
      }
      return `workflow://bizbuilderprompts/${entry.workflowId ?? entry.id}`;
    default:
      return `prompt://bizbuilderprompts/${entry.category}/${entry.id}`;
  }
}
