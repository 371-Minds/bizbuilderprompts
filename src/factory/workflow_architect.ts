import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { AssetSpec, AssetDraft, WorkflowFramework } from "./types.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const FRAMEWORK_DESCRIPTIONS: Record<WorkflowFramework, { name: string; phases: string[] }> = {
  dsf: {
    name: "Discover → Space → Flow",
    phases: ["Discover", "Space", "Flow"],
  },
  rcrc: {
    name: "Research → Clarify → Recommend → Confirm",
    phases: ["Research", "Clarify", "Recommend", "Confirm"],
  },
  kaizen: {
    name: "Kaizen Continuous Improvement",
    phases: ["Assess", "Identify", "Plan", "Execute", "Measure", "Reflect"],
  },
  alchemist: {
    name: "Alchemist Apprenticeship",
    phases: ["Awareness", "Foundation", "Practice", "Mastery", "Transmutation", "Legacy"],
  },
  custom: {
    name: "Custom Framework",
    phases: [],
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function detectFramework(spec: AssetSpec): WorkflowFramework {
  if (spec.framework && spec.framework !== "custom") return spec.framework;
  const text = `${spec.goal} ${spec.topic} ${spec.context ?? ""}`.toLowerCase();
  if (text.includes("discover") || text.includes("explore") || text.includes("strategy")) return "dsf";
  if (text.includes("research") || text.includes("analyze") || text.includes("recommend")) return "rcrc";
  if (text.includes("improve") || text.includes("optimize") || text.includes("kaizen") || text.includes("continuous")) return "kaizen";
  if (text.includes("master") || text.includes("learn") || text.includes("skill") || text.includes("training")) return "alchemist";
  return "dsf"; // default to DSF
}

function buildStepTitles(spec: AssetSpec, framework: WorkflowFramework): string[] {
  if (spec.steps && spec.steps.length > 0) return spec.steps;

  const { phases } = FRAMEWORK_DESCRIPTIONS[framework];
  const goal = spec.goal;
  const topic = spec.topic;

  switch (framework) {
    case "dsf":
      return [
        `Discover — ${topic} Landscape Analysis`,
        `Discover — Stakeholder & Audience Mapping`,
        `Discover — Problem & Opportunity Definition`,
        `Space — Strategy Development for ${topic}`,
        `Space — Resource & Capability Assessment`,
        `Flow — ${goal} Execution Plan`,
        `Flow — Implementation & Monitoring`,
        `Flow — Review & Optimization`,
      ].slice(0, phases.length > 0 ? 8 : 5);

    case "rcrc":
      return [
        `Research — ${topic} Intelligence Gathering`,
        `Research — Competitive & Market Analysis`,
        `Clarify — Define Success Criteria for ${goal}`,
        `Clarify — Stakeholder Alignment`,
        `Recommend — ${topic} Strategy Recommendations`,
        `Confirm — Validation & Sign-off Process`,
      ];

    case "kaizen":
      return [
        `Assess — Current State of ${topic}`,
        `Identify — Improvement Opportunities`,
        `Plan — Kaizen Action Plan for ${goal}`,
        `Execute — Implement Changes`,
        `Measure — Track Progress Metrics`,
        `Reflect — Review & Next Cycle`,
      ];

    case "alchemist":
      return [
        `Awareness — Foundations of ${topic}`,
        `Foundation — Core Principles & Frameworks`,
        `Practice — Applied Exercises for ${goal}`,
        `Mastery — Advanced Techniques`,
        `Transmutation — Real-World Application`,
        `Legacy — Teaching & Scaling`,
      ];

    default:
      return [
        `Phase 1 — Introduction to ${topic}`,
        `Phase 2 — Strategy for ${goal}`,
        `Phase 3 — Implementation`,
        `Phase 4 — Measurement & Optimization`,
        `Phase 5 — Review & Next Steps`,
      ];
  }
}

function buildMasterPrompt(spec: AssetSpec, framework: WorkflowFramework, stepTitles: string[]): string {
  const frameworkDef = FRAMEWORK_DESCRIPTIONS[framework];
  const audience = spec.audience ?? "your team";
  const context = spec.context ? `\n\n**Context:** ${spec.context}` : "";

  return [
    `# ${spec.topic} — Master Workflow`,
    "",
    `> **Framework:** ${frameworkDef.name}`,
    `> **Goal:** ${spec.goal}`,
    `> **Audience:** ${audience}`,
    context,
    "",
    "---",
    "",
    "## Overview",
    "",
    `This workflow guides you through a structured ${frameworkDef.name} process to achieve: **${spec.goal}**.`,
    "",
    `It is designed for ${audience} and consists of ${stepTitles.length} sequential steps.`,
    spec.style ? `\n**Style & Tone:** ${spec.style}` : "",
    "",
    "## How to Use This Workflow",
    "",
    "1. Start with **Step 1** and complete each step before proceeding",
    "2. Fill in `{{Variable}}` placeholders with your specific context",
    "3. Each step builds on the previous — don't skip ahead",
    "4. Review outputs at each step before moving forward",
    "5. Use the master prompt for orientation; use step files for execution",
    "",
    "## Workflow Steps",
    "",
    ...stepTitles.map((title, i) => `${i + 1}. **${title}**`),
    "",
    "---",
    "",
    "## Variables",
    "",
    `- **{{Topic}}** — ${spec.topic}`,
    `- **{{Goal}}** — ${spec.goal}`,
    `- **{{Audience}}** — ${audience}`,
    `- **{{Business Context}}** — Your specific business situation`,
  ].filter((l) => l !== undefined).join("\n");
}

function buildStepContent(
  spec: AssetSpec,
  stepTitle: string,
  stepNumber: number,
  totalSteps: number,
  framework: WorkflowFramework
): string {
  const isFirst = stepNumber === 1;
  const isLast = stepNumber === totalSteps;
  const nextStepNote = isLast ? "**This is the final step. Review all outputs and synthesize findings.**" : `Next: proceed to Step ${stepNumber + 1}.`;

  return [
    `# Step ${stepNumber}: ${stepTitle}`,
    "",
    `> **Workflow:** {{Topic}} — ${FRAMEWORK_DESCRIPTIONS[framework].name}`,
    `> **Step ${stepNumber} of ${totalSteps}**`,
    isFirst ? "> ⚡ **Starting point** — begin here" : "",
    isLast ? "> 🎯 **Final step** — synthesize and complete" : "",
    "",
    "---",
    "",
    "## Objective",
    "",
    `Complete the **${stepTitle}** phase of your ${spec.topic} workflow.`,
    "",
    "## Instructions",
    "",
    `Working on: **{{Business Context}}**`,
    `Goal for this step: Complete the ${stepTitle.split("—")[0].trim()} phase.`,
    "",
    "### Guiding Questions",
    "",
    ...getStepQuestions(stepTitle, spec, stepNumber),
    "",
    "## Deliverable",
    "",
    `At the end of this step, you should have:`,
    `- A clear output from the ${stepTitle.split("—")[0].trim()} phase`,
    "- Written documentation or decisions to carry forward",
    "- Clarity on what needs to happen in the next step",
    "",
    "## Context",
    "",
    "```",
    "Topic: {{Topic}}",
    "Goal: {{Goal}}",
    "Context: {{Business Context}}",
    "```",
    "",
    "---",
    "",
    nextStepNote,
  ].filter((l) => l !== undefined).join("\n");
}

function getStepQuestions(stepTitle: string, spec: AssetSpec, stepNumber: number): string[] {
  const title = stepTitle.toLowerCase();

  if (title.includes("discover") || title.includes("assess") || title.includes("research")) {
    return [
      `- What is the current state of {{Topic}} in your context?`,
      `- Who are the key stakeholders affected by {{Goal}}?`,
      `- What data or evidence do you have about the current situation?`,
      `- What are the biggest unknowns that need to be resolved?`,
    ];
  }
  if (title.includes("strategy") || title.includes("plan") || title.includes("recommend")) {
    return [
      `- What is the ideal outcome of achieving {{Goal}}?`,
      `- What are 3-5 strategic approaches to reach this goal?`,
      `- What resources, tools, or people are needed?`,
      `- What are the risks and how can they be mitigated?`,
    ];
  }
  if (title.includes("execut") || title.includes("implement") || title.includes("flow")) {
    return [
      `- What are the specific action items for this phase?`,
      `- What is the timeline for each action item?`,
      `- Who is responsible for each deliverable?`,
      `- What does "done" look like for this step?`,
    ];
  }
  if (title.includes("measur") || title.includes("monitor") || title.includes("review")) {
    return [
      `- What metrics indicate progress toward {{Goal}}?`,
      `- What is the current baseline and target?`,
      `- How will you track and report on progress?`,
      `- What triggers a course correction?`,
    ];
  }
  // Generic
  return [
    `- What is the most important thing to address in this step?`,
    `- What information do you need to move forward?`,
    `- What decision needs to be made?`,
    `- What is the success criteria for completing this step?`,
  ];
}

export interface WorkflowDesign {
  masterPrompt: string;
  masterFilename: string;
  steps: Array<{ filename: string; content: string; stepNumber: number; title: string }>;
  dirName: string;
  framework: WorkflowFramework;
  draft: AssetDraft;
}

/**
 * Designs a complete multi-step workflow from an AssetSpec.
 * Returns master prompt content, all step contents, and suggested file names.
 */
export function designWorkflow(spec: AssetSpec): WorkflowDesign {
  const framework = detectFramework(spec);
  const stepTitles = buildStepTitles(spec, framework);
  const masterContent = buildMasterPrompt(spec, framework, stepTitles);
  const slug = slugify(spec.topic);
  const dirName = `run_${slug.replace(/-/g, "_")}`;

  const steps = stepTitles.map((title, i) => {
    const stepNumber = i + 1;
    const stepSlug = slugify(title.split("—")[1]?.trim() ?? title).slice(0, 40);
    const filename = `${stepNumber}_${stepSlug}.md`;
    const content = buildStepContent(spec, title, stepNumber, stepTitles.length, framework);
    return { filename, content, stepNumber, title };
  });

  // Build a combined content preview for the draft
  const combinedContent = [
    masterContent,
    "",
    "---",
    "",
    ...steps.map((s) => `## Step ${s.stepNumber}: ${s.title}\n\n${s.content.slice(0, 200)}...`),
  ].join("\n");

  const draft: AssetDraft = {
    spec,
    content: combinedContent,
    suggestedFilename: `${dirName}/master_prompt.md`,
    suggestedCategory: "workflow",
    variables: ["Topic", "Goal", "Business Context", "Audience"],
    estimatedQuality: "high",
  };

  return {
    masterPrompt: masterContent,
    masterFilename: "master_prompt.md",
    steps,
    dirName,
    framework,
    draft,
  };
}

/**
 * Write the designed workflow files to a target base directory.
 * Returns the list of files written.
 */
export function writeWorkflowToDisk(
  design: WorkflowDesign,
  baseDir: string
): string[] {
  const workflowDir = join(baseDir, design.dirName);
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }

  const written: string[] = [];

  const masterPath = join(workflowDir, design.masterFilename);
  writeFileSync(masterPath, design.masterPrompt, "utf-8");
  written.push(masterPath);

  for (const step of design.steps) {
    const stepPath = join(workflowDir, step.filename);
    writeFileSync(stepPath, step.content, "utf-8");
    written.push(stepPath);
  }

  return written;
}
