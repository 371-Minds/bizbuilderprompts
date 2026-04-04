import type { AssetSpec, AssetDraft, WorkflowFramework } from "./types.js";
import { extractVariables } from "../utils/template.js";

const FRAMEWORK_SYSTEM_PROMPTS: Record<WorkflowFramework, string> = {
  dsf: "Follow the DSF (Discover → Space → Flow) framework structure.",
  rcrc: "Follow the RCRC (Research → Clarify → Recommend → Confirm) framework.",
  kaizen: "Apply Kaizen continuous improvement principles — small, consistent, measurable changes.",
  alchemist: "Use the Alchemist Apprenticeship framework — transmuting raw concepts into mastery.",
  custom: "Design a custom framework appropriate for the stated goal.",
};

const CATEGORY_FOR_TYPE: Record<string, string> = {
  sales: "sales",
  marketing: "marketing",
  "go-to-market": "marketing",
  gtm: "marketing",
  brand: "marketing",
  content: "marketing",
  video: "video",
  image: "image-prompt",
  visual: "image-prompt",
  legal: "general",
  compliance: "general",
  finance: "general",
  tax: "general",
  product: "project",
  startup: "project",
  operations: "general",
  ops: "general",
  strategy: "marketing",
};

function inferCategory(spec: AssetSpec): string {
  const text = `${spec.topic} ${spec.goal} ${spec.audience ?? ""}`.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_FOR_TYPE)) {
    if (text.includes(keyword)) return category;
  }
  return "general";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Crafts a structured prompt asset from an AssetSpec.
 * Returns a fully-formed markdown prompt with role, task, constraints,
 * output format, and {{Variable}} placeholders.
 */
export function craftPrompt(spec: AssetSpec): AssetDraft {
  const audience = spec.audience ?? "business professionals";
  const style = spec.style ?? "clear, actionable, and results-focused";
  const frameworkNote = spec.framework ? FRAMEWORK_SYSTEM_PROMPTS[spec.framework] : "";
  const category = inferCategory(spec);

  // Build the role/persona section
  const roleSection = buildRoleSection(spec, audience);

  // Build the task section
  const taskSection = buildTaskSection(spec);

  // Build constraints
  const constraintsSection = buildConstraints(spec, style);

  // Build output format
  const outputSection = buildOutputFormat(spec);

  // Build examples / variables
  const variablesSection = buildVariables(spec);

  const parts: string[] = [
    `# ${spec.topic}`,
    "",
    `> **Goal:** ${spec.goal}`,
    `> **Audience:** ${audience}`,
    spec.framework ? `> **Framework:** ${spec.framework.toUpperCase()}` : "",
    "",
    "---",
    "",
    roleSection,
    "",
    taskSection,
    "",
    constraintsSection,
    "",
    outputSection,
    "",
    variablesSection,
  ].filter((l) => l !== undefined);

  if (frameworkNote) {
    parts.push("", `## Framework Guidance`, "", frameworkNote);
  }

  const content = parts.join("\n").trim();
  const variables = extractVariables(content);
  const slug = slugify(spec.topic);
  const suggestedFilename = `${slug}.md`;

  return {
    spec,
    content,
    suggestedFilename,
    suggestedCategory: category,
    variables,
    estimatedQuality: variables.length >= 2 ? "high" : "medium",
  };
}

function buildRoleSection(spec: AssetSpec, audience: string): string {
  const topicLower = spec.topic.toLowerCase();
  let roleDescription = "world-class business consultant";

  if (topicLower.includes("sales") || topicLower.includes("conversion")) {
    roleDescription = "elite sales strategist and conversion copywriter";
  } else if (topicLower.includes("marketing") || topicLower.includes("brand") || topicLower.includes("campaign")) {
    roleDescription = "performance marketing expert and brand strategist";
  } else if (topicLower.includes("legal") || topicLower.includes("compliance")) {
    roleDescription = "experienced business attorney and compliance specialist";
  } else if (topicLower.includes("finance") || topicLower.includes("tax") || topicLower.includes("financial")) {
    roleDescription = "senior CFO and financial strategist";
  } else if (topicLower.includes("product") || topicLower.includes("roadmap") || topicLower.includes("feature")) {
    roleDescription = "seasoned product leader with deep user empathy";
  } else if (topicLower.includes("tech") || topicLower.includes("engineering") || topicLower.includes("ai") || topicLower.includes("automation")) {
    roleDescription = "senior software architect and AI systems expert";
  } else if (topicLower.includes("content") || topicLower.includes("copy") || topicLower.includes("writing")) {
    roleDescription = "master copywriter and content strategist";
  } else if (topicLower.includes("strategy") || topicLower.includes("growth") || topicLower.includes("venture")) {
    roleDescription = "strategic business advisor with a track record of scaling ventures";
  }

  return [
    "## Your Role",
    "",
    `You are a ${roleDescription}. You specialize in helping ${audience} achieve ${spec.goal}.`,
    "",
    `Your task is to provide expert-level guidance on **{{Topic}}** with precision, actionable specificity, and measurable outcomes.`,
  ].join("\n");
}

function buildTaskSection(spec: AssetSpec): string {
  return [
    "## Task",
    "",
    `Provide comprehensive, expert guidance on the following topic:`,
    "",
    `**Topic:** {{Topic}}`,
    `**Primary Goal:** {{Goal}}`,
    spec.context ? `**Context:** {{Context}}` : `**Context:** {{Business Context}}`,
    "",
    "Focus on delivering insights that are:",
    "- **Immediately actionable** — specific steps, not vague advice",
    "- **Results-oriented** — tied to measurable business outcomes",
    "- **Tailored** — specific to the provided context and audience",
  ].join("\n");
}

function buildConstraints(spec: AssetSpec, style: string): string {
  return [
    "## Constraints & Style",
    "",
    `- Tone: ${style}`,
    "- Avoid generic advice — be specific to the given context",
    "- Include both strategic thinking AND tactical execution steps",
    "- Format with clear headers, numbered lists, and bold key points",
    "- Length: comprehensive but scannable — no fluff, maximum signal",
  ].join("\n");
}

function buildOutputFormat(spec: AssetSpec): string {
  const sections = getOutputSections(spec);
  return [
    "## Output Format",
    "",
    "Structure your response with these sections:",
    "",
    ...sections.map((s, i) => `${i + 1}. **${s}**`),
  ].join("\n");
}

function getOutputSections(spec: AssetSpec): string[] {
  const topic = spec.topic.toLowerCase();

  if (topic.includes("sales") || topic.includes("conversion") || topic.includes("closing")) {
    return ["Situation Analysis", "Key Strategies", "Tactical Action Plan", "Scripts & Templates", "Success Metrics", "Common Pitfalls to Avoid"];
  }
  if (topic.includes("marketing") || topic.includes("campaign") || topic.includes("brand")) {
    return ["Market Context", "Core Strategy", "Channel Breakdown", "Content & Creative Direction", "Launch Sequence", "KPIs & Measurement"];
  }
  if (topic.includes("legal") || topic.includes("compliance")) {
    return ["Legal Landscape Overview", "Key Requirements", "Risk Assessment", "Action Checklist", "Implementation Timeline", "Resources & Next Steps"];
  }
  if (topic.includes("product") || topic.includes("roadmap") || topic.includes("feature")) {
    return ["Problem Definition", "Solution Framework", "Prioritization Matrix", "Implementation Plan", "Success Criteria", "Stakeholder Alignment"];
  }
  if (topic.includes("finance") || topic.includes("financial") || topic.includes("tax")) {
    return ["Financial Context", "Key Considerations", "Strategic Options", "Implementation Steps", "Risk Factors", "Monitoring Framework"];
  }
  // Default
  return ["Executive Summary", "Core Analysis", "Strategic Recommendations", "Action Plan", "Success Metrics", "Next Steps"];
}

function buildVariables(spec: AssetSpec): string {
  const hasContext = !spec.context;
  const lines = [
    "## Template Variables",
    "",
    "Fill in these variables before using this prompt:",
    "",
    `- **{{Topic}}** — The specific topic or subject to address (e.g., "${spec.topic}")`,
    `- **{{Goal}}** — The desired outcome or objective (e.g., "${spec.goal}")`,
    hasContext ? `- **{{Business Context}}** — Brief description of your business, industry, or situation` : `- **{{Context}}** — ${spec.context}`,
    `- **{{Target Audience}}** — Who this is for (e.g., "${spec.audience ?? "your target audience"}")`,
  ];

  if (spec.style) {
    lines.push(`- **{{Style}}** — Communication tone and style (e.g., "${spec.style}")`);
  }

  return lines.join("\n");
}
