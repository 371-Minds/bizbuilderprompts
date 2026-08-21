import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { fileURLToPath } from "url";
import type { AgentPersona, AgentRegistry } from "./types.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const AGENTS_DIR = join(REPO_ROOT, "agents");

/**
 * Accept any non-empty lowercase role id. The 8 C-Suite roles (ceo, cmo, ...)
 * ship as .md files in agents/; specialist personas (growth_hacker, grant_writer,
 * housing_sme, etc.) can be registered at runtime via register_agent. Both
 * load through the same registry — the role just has to be a valid identifier.
 */
function isValidRole(role: string): boolean {
  return /^[a-z][a-z0-9_]{1,48}$/.test(role);
}

function parseYamlFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ")) {
      // array item (only at top level — handled below via current key tracking)
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();

    if (val === "") {
      // Multi-line list value: collect following "- " lines
      result[key] = [];
    } else {
      result[key] = val;
    }
  }

  // Second pass: collect array items
  let currentKey: string | null = null;
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("- ")) {
      if (currentKey && Array.isArray(result[currentKey])) {
        (result[currentKey] as string[]).push(trimmed.slice(2).trim());
      }
    } else if (trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      currentKey = trimmed.slice(0, colonIdx).trim();
    }
  }

  return result;
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

function extractSystemPrompt(body: string): string {
  const sysMatch = body.match(/## System Prompt\r?\n\r?\n([\s\S]*?)(?=\r?\n## |\r?\n---|\s*$)/);
  if (sysMatch) return sysMatch[1].trim();
  // Fall back to first substantial paragraph
  const lines = body.split("\n").filter((l) => l.trim().length > 30);
  return lines.slice(0, 3).join(" ").trim();
}

function parseAgentFile(filePath: string): AgentPersona | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const fm = parseYamlFrontmatter(content);
  const role = String(fm["role"] ?? "");
  if (!isValidRole(role)) return null;

  const body = stripFrontmatter(content);
  const systemPrompt = extractSystemPrompt(body);

  const toStringArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string" && v) return [v];
    return [];
  };

  return {
    role,
    displayName: String(fm["displayName"] ?? role),
    description: String(fm["description"] ?? ""),
    systemPrompt,
    preferredCategories: toStringArray(fm["preferredCategories"]),
    defaultWorkflows: toStringArray(fm["defaultWorkflows"]),
    toolPermissions: toStringArray(fm["toolPermissions"]),
    orderingPatterns: toStringArray(fm["orderingPatterns"]),
  };
}

let _registry: AgentRegistry | null = null;

export function loadAgentRegistry(forceReload = false): AgentRegistry {
  if (_registry && !forceReload) return _registry;

  const agents: AgentPersona[] = [];

  if (!existsSync(AGENTS_DIR)) {
    _registry = { agents, lastLoaded: new Date().toISOString() };
    return _registry;
  }

  let files: string[];
  try {
    files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    _registry = { agents, lastLoaded: new Date().toISOString() };
    return _registry;
  }

  for (const file of files) {
    const persona = parseAgentFile(join(AGENTS_DIR, file));
    if (persona) agents.push(persona);
  }

  _registry = { agents, lastLoaded: new Date().toISOString() };
  return _registry;
}

export function getAgentPersona(role: string): AgentPersona | undefined {
  return loadAgentRegistry().agents.find((a) => a.role === role);
}

export function listAgents(): AgentPersona[] {
  return loadAgentRegistry().agents;
}

export function registerAgent(persona: AgentPersona): string {
  if (!existsSync(AGENTS_DIR)) {
    mkdirSync(AGENTS_DIR, { recursive: true });
  }

  const filename = `${persona.role}.md`;
  const filePath = join(AGENTS_DIR, filename);

  const frontmatter = [
    "---",
    `role: ${persona.role}`,
    `displayName: ${persona.displayName}`,
    `description: ${persona.description}`,
    `preferredCategories:`,
    ...persona.preferredCategories.map((c) => `  - ${c}`),
    `defaultWorkflows:`,
    ...persona.defaultWorkflows.map((w) => `  - ${w}`),
    `toolPermissions:`,
    ...persona.toolPermissions.map((t) => `  - ${t}`),
    `orderingPatterns:`,
    ...persona.orderingPatterns.map((p) => `  - "${p}"`),
    "---",
    "",
    `# ${persona.displayName}`,
    "",
    "## System Prompt",
    "",
    persona.systemPrompt,
    "",
  ].join("\n");

  writeFileSync(filePath, frontmatter, "utf-8");

  // Invalidate cache
  _registry = null;

  return filePath;
}
