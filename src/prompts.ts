import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Manifest } from "./types.js";
import { getPromptContent } from "./manifest.js";
import type { AgentRegistry } from "./agents/types.js";

/**
 * Registers named MCP Prompts — executable prompt templates that AI clients
 * can invoke by name with structured arguments.
 */
export function registerPrompts(server: McpServer, manifest: Manifest, registry?: AgentRegistry): void {
  // ── Prompt 1: business_copywriting ──────────────────────────────────────
  server.registerPrompt(
    "business_copywriting",
    {
      title: "Business Copywriting",
      description:
        "Transforms any text into high-converting business copy using proven copywriting frameworks (AIDA, PAS, benefit-driven). Provide your original text and context.",
      argsSchema: {
        original_text: z.string().describe("The text you want to improve"),
        target_audience: z
          .string()
          .optional()
          .describe("Who will read this text (e.g. 'small business owners')"),
        text_goal: z
          .string()
          .optional()
          .describe("What the reader should do (e.g. 'Sign up for trial', 'Click link')"),
        brand_voice: z
          .string()
          .optional()
          .describe("Desired tone (e.g. 'Professional & Authoritative', 'Playful & Witty')"),
      },
    },
    async ({ original_text, target_audience, text_goal, brand_voice }) => {
      const copywriterEntry = manifest.prompts.find((p) =>
        p.id.includes("conversion-copywriter") || p.title.toLowerCase().includes("conversion copywriter")
      );
      const systemPrompt = copywriterEntry
        ? getPromptContent(copywriterEntry)
            .replace("{{Original_Text}}", original_text)
            .replace("{{Target_Audience}}", target_audience ?? "general business audience")
            .replace("{{Text_Goal}}", text_goal ?? "engage and convert")
            .replace("{{Brand_Voice}}", brand_voice ?? "professional and clear")
        : buildFallbackCopywritingPrompt(original_text, target_audience, text_goal, brand_voice);

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: systemPrompt,
            },
          },
        ],
      };
    }
  );

  // ── Prompt 2: kaizen_improvement ─────────────────────────────────────────
  server.registerPrompt(
    "kaizen_improvement",
    {
      title: "Kaizen Continuous Improvement",
      description:
        "Applies the Japanese Kaizen philosophy to design a sustainable self-improvement or business improvement system through tiny, consistent changes.",
      argsSchema: {
        area: z.string().describe("The area you want to improve (e.g. 'my morning routine', 'customer onboarding')"),
        current_state: z
          .string()
          .optional()
          .describe("Brief description of the current situation"),
        improvement_goal: z
          .string()
          .optional()
          .describe("What you want to achieve with this improvement"),
      },
    },
    async ({ area, current_state, improvement_goal }) => {
      const kaizenEntry = manifest.prompts.find((p) =>
        p.id.includes("kaizen") || p.title.toLowerCase().includes("kaizen")
      );
      const systemPromptBase = kaizenEntry
        ? getPromptContent(kaizenEntry)
        : "You are the Kaizen Mastermind, an expert in continuous improvement through small, consistent changes.";

      const userMessage = [
        systemPromptBase,
        "",
        `I want to apply Kaizen to: **${area}**`,
        current_state ? `Current state: ${current_state}` : "",
        improvement_goal ? `Goal: ${improvement_goal}` : "",
        "",
        "Please create a customized Kaizen Protocol with micro-improvements, measurement systems, and implementation rituals.",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: userMessage },
          },
        ],
      };
    }
  );

  // ── Prompt 3: run_workflow ────────────────────────────────────────────────
  server.registerPrompt(
    "run_workflow",
    {
      title: "Run Business Workflow",
      description:
        "Executes a complete multi-step business workflow. Returns the full sequence of prompts in order so you can work through them step by step.",
      argsSchema: {
        workflow_id: z
          .string()
          .describe("The workflow ID to run (e.g. 'modumind-r2r', 'legal-tasks', 'venture-forge')"),
        context: z
          .string()
          .optional()
          .describe("Your business context — describe your situation so the workflow can be applied to your specific case"),
      },
    },
    async ({ workflow_id, context }) => {
      const workflow = manifest.workflows.find((w) => w.id === workflow_id);
      if (!workflow) {
        const available = manifest.workflows.map((w) => w.id).join(", ");
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Workflow "${workflow_id}" not found. Available workflows: ${available}`,
              },
            },
          ],
        };
      }

      const masterEntry = workflow.masterPromptPath
        ? manifest.prompts.find((p) => p.filePath === workflow.masterPromptPath)
        : undefined;

      const parts: string[] = [
        `# ${workflow.title}`,
        "",
        workflow.description,
        "",
      ];

      if (masterEntry) {
        parts.push("## Overview", "", getPromptContent(masterEntry), "");
      }

      if (context) {
        parts.push("## Your Context", "", context, "");
      }

      parts.push(`## Workflow Steps (${workflow.steps.length} total)`, "");

      for (const step of workflow.steps) {
        const stepEntry = manifest.prompts.find((p) => p.filePath === step.filePath);
        const stepContent = stepEntry ? getPromptContent(stepEntry) : "";
        parts.push(`### Step ${step.stepNumber}: ${step.title}`, "", stepContent, "");
      }

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: parts.join("\n") },
          },
        ],
      };
    }
  );

  // ── Prompt 4: legal_compliance ────────────────────────────────────────────
  server.registerPrompt(
    "legal_compliance",
    {
      title: "Legal & Compliance Guide",
      description:
        "Provides a comprehensive legal and compliance framework for your business. Covers data privacy, IP, terms of service, AI ethics, security, and more.",
      argsSchema: {
        business_type: z
          .string()
          .describe("Your business type (e.g. 'SaaS startup', 'e-commerce', 'AI platform')"),
        focus_area: z
          .string()
          .optional()
          .describe(
            "Specific area to focus on: privacy, intellectual-property, terms-of-service, ai-ethics, security, marketing-compliance, digital-economies"
          ),
      },
    },
    async ({ business_type, focus_area }) => {
      const legalWorkflow = manifest.workflows.find((w) => w.id === "legal-tasks");
      let content = "";

      if (legalWorkflow) {
        if (focus_area) {
          const focusStep = legalWorkflow.steps.find(
            (s) =>
              s.title.toLowerCase().includes(focus_area.replace(/-/g, " ")) ||
              s.id.includes(focus_area.replace(/-/g, "_"))
          );
          if (focusStep) {
            const stepEntry = manifest.prompts.find((p) => p.filePath === focusStep.filePath);
            content = stepEntry ? getPromptContent(stepEntry) : "";
          }
        }

        if (!content && legalWorkflow.masterPromptPath) {
          const masterEntry = manifest.prompts.find(
            (p) => p.filePath === legalWorkflow.masterPromptPath
          );
          content = masterEntry ? getPromptContent(masterEntry) : "";
        }
      }

      const message = [
        `I am building a **${business_type}** and need legal and compliance guidance.`,
        focus_area ? `\nSpecific focus: ${focus_area.replace(/-/g, " ")}` : "",
        "",
        content || "Please provide comprehensive legal compliance guidance for my business.",
      ]
        .filter((s) => s !== "")
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: message },
          },
        ],
      };
    }
  );

  // ── Prompt 5: generate_image_prompt ───────────────────────────────────────
  server.registerPrompt(
    "generate_image_prompt",
    {
      title: "Generate Product Image Prompt",
      description:
        "Creates a structured JSON prompt for AI image/video generation of a product. Based on the Veo prompt format used in this library.",
      argsSchema: {
        product_name: z.string().describe("Name of the product"),
        product_type: z.string().describe("Type of product (e.g. 'smartwatch', 'energy drink')"),
        brand_style: z
          .string()
          .optional()
          .describe("Brand style (e.g. 'Futuristic, tech-savvy', 'Luxury, minimalist')"),
        visual_style: z
          .string()
          .optional()
          .describe("Visual style preferences (e.g. 'sleek, high-tech', 'warm, organic')"),
      },
    },
    async ({ product_name, product_type, brand_style, visual_style }) => {
      const existingExample = manifest.prompts.find(
        (p) => p.fileType === "image-prompt"
      );
      const exampleContent = existingExample
        ? `Here is an example of the prompt format:\n\n${getPromptContent(existingExample)}\n\n`
        : "";

      const message = [
        `${exampleContent}Using the above JSON structure as a template, create a product image/video generation prompt for:`,
        "",
        `- **Product Name:** ${product_name}`,
        `- **Product Type:** ${product_type}`,
        `- **Brand Style:** ${brand_style ?? "modern and professional"}`,
        `- **Visual Style:** ${visual_style ?? "clean and polished"}`,
        "",
        "Generate a complete JSON prompt with description, camera, lighting, location, atmosphere, elements, motion, cta_motion, ending, text, and keywords fields.",
      ].join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: message },
          },
        ],
      };
    }
  );

  // ── Prompt 6: business_strategy ───────────────────────────────────────────
  server.registerPrompt(
    "business_strategy",
    {
      title: "Business Strategy Framework",
      description:
        "Applies proven business strategy frameworks to help you plan, validate, and grow your business idea.",
      argsSchema: {
        business_idea: z
          .string()
          .describe("Your business idea or current business situation"),
        stage: z
          .string()
          .optional()
          .describe("Stage: ideation, validation, growth, scaling"),
        challenge: z
          .string()
          .optional()
          .describe("The specific challenge or decision you're facing"),
      },
    },
    async ({ business_idea, stage, challenge }) => {
      const strategyEntries = manifest.prompts.filter(
        (p) =>
          p.category === "sales" &&
          (p.id.includes("strategy") || p.id.includes("value") || p.id.includes("growth"))
      );
      const marketingEntries = manifest.prompts.filter(
        (p) => p.category === "marketing" && p.id.includes("growth")
      );

      const relevantEntry = strategyEntries[0] ?? marketingEntries[0];
      const basePrompt = relevantEntry ? getPromptContent(relevantEntry) : "";

      const message = [
        `I need strategic guidance for my business:`,
        "",
        `**Business:** ${business_idea}`,
        stage ? `**Stage:** ${stage}` : "",
        challenge ? `**Challenge:** ${challenge}` : "",
        "",
        basePrompt
          ? `Please apply the following strategic framework to my situation:\n\n${basePrompt}`
          : "Please provide a comprehensive strategic analysis and action plan.",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: message },
          },
        ],
      };
    }
  );

  // ── Prompt 7: assume_role ─────────────────────────────────────────────────
  server.registerPrompt(
    "assume_role",
    {
      title: "Assume C-Suite Role",
      description:
        "Activates a C-Suite agent persona. The AI will adopt the role's system prompt, priorities, and operating principles for the session.",
      argsSchema: {
        role: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .describe("The C-Suite role to assume"),
        context: z
          .string()
          .optional()
          .describe("Your current business context or the task you want to work on"),
      },
    },
    async ({ role, context }) => {
      const persona = registry?.agents.find((a) => a.role === role);

      if (!persona) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Role "${role}" not found. Available roles: ceo, cmo, cfo, cto, vp_sales, vp_product, legal_counsel, head_of_ops`,
              },
            },
          ],
        };
      }

      const defaultWorkflowList = persona.defaultWorkflows.length > 0
        ? `\n\n**Your Default Workflows:** ${persona.defaultWorkflows.join(", ")}\nAccess them with: get_workflow`
        : "";

      const preferredCategoryList = persona.preferredCategories.length > 0
        ? `\n\n**Your Preferred Asset Categories:** ${persona.preferredCategories.join(", ")}`
        : "";

      const orderExamples = persona.orderingPatterns.slice(0, 3)
        .map((p, i) => `${i + 1}. "${p}"`)
        .join("\n");

      const sessionMessage = [
        persona.systemPrompt,
        defaultWorkflowList,
        preferredCategoryList,
        `\n\n**Example Orders You Can Place:**\n${orderExamples}`,
        context ? `\n\n---\n\n**Current Context:**\n${context}` : "",
        "\n\n---\n\nYou are now operating as the **" + persona.displayName + "**. Use `create_order` to request assets from the warehouse, `browse_warehouse` to explore available assets, or `commission_prompt` / `commission_workflow` to create new ones.",
      ].filter(Boolean).join("");

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: sessionMessage },
          },
        ],
      };
    }
  );

  // ── Prompt 8: order_from_warehouse ────────────────────────────────────────
  server.registerPrompt(
    "order_from_warehouse",
    {
      title: "Order From Warehouse",
      description:
        "Guided ordering experience for C-Suite agents. Describe what you need and the system will find existing assets, identify gaps, and suggest what to commission.",
      argsSchema: {
        role: z
          .enum(["ceo", "cmo", "cfo", "cto", "vp_sales", "vp_product", "legal_counsel", "head_of_ops"])
          .describe("Your C-Suite role"),
        intent: z
          .string()
          .describe("What you need — describe your goal, project, or challenge"),
        urgency: z
          .enum(["low", "normal", "high"])
          .optional()
          .describe("How urgently you need this"),
      },
    },
    async ({ role, intent, urgency }) => {
      const persona = registry?.agents.find((a) => a.role === role);
      const roleDisplay = persona?.displayName ?? role.toUpperCase();

      const orderInstructions = [
        `# ${roleDisplay} — Warehouse Order`,
        "",
        `**Intent:** ${intent}`,
        `**Urgency:** ${urgency ?? "normal"}`,
        "",
        "---",
        "",
        "## How to Fulfill This Order",
        "",
        "Follow these steps to get the assets you need:",
        "",
        "**Step 1: Search Existing Assets**",
        "```",
        `create_order({ role: "${role}", intent: "${intent}", urgency: "${urgency ?? "normal"}" })`,
        "```",
        "",
        "**Step 2: Browse the Warehouse**",
        "```",
        `browse_warehouse({ role: "${role}", query: "${intent.slice(0, 50)}" })`,
        "```",
        "",
        "**Step 3: Fill in Gaps**",
        "If assets are missing, commission them:",
        "```",
        `commission_prompt({ topic: "[asset topic]", goal: "${intent}", requested_by: "${role}", save: true })`,
        "```",
        "",
        "**Step 4: For Multi-Step Processes**",
        "```",
        `commission_workflow({ topic: "[workflow topic]", goal: "${intent}", requested_by: "${role}", save: true })`,
        "```",
        "",
        "**Step 5: Package into a Bundle**",
        "```",
        `commission_bundle({ theme: "[bundle name]", goal: "${intent}", roles: ["${role}"] })`,
        "```",
        "",
        persona?.defaultWorkflows.length
          ? `## Your Default Workflows\n\nYou have quick access to: **${persona.defaultWorkflows.join(", ")}**\nRun them with \`get_workflow\` or the \`run_workflow\` prompt.`
          : "",
      ].filter(Boolean).join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: orderInstructions },
          },
        ],
      };
    }
  );
}

function buildFallbackCopywritingPrompt(
  text: string,
  audience?: string,
  goal?: string,
  voice?: string
): string {
  return [
    "You are a world-class conversion copywriter and persuasion engineer.",
    "Transform the following text into high-converting, engaging copy using AIDA and PAS frameworks.",
    "",
    `Original Text: ${text}`,
    audience ? `Target Audience: ${audience}` : "",
    goal ? `Goal: ${goal}` : "",
    voice ? `Brand Voice: ${voice}` : "",
    "",
    "Provide: 1) Enhanced version 2) Key improvements 3) Techniques used 4) Expected impact",
  ]
    .filter(Boolean)
    .join("\n");
}
