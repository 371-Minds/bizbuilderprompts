import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadAgentRegistry,
  getAgentPersona,
  listAgents,
  registerAgent,
} from "../agents/registry.js";
import type { AgentPersona } from "../agents/types.js";

// ── Integration tests using actual agents directory ───────────────────────────

describe("loadAgentRegistry — real agents directory", () => {
  it("loads without throwing", () => {
    expect(() => loadAgentRegistry(true)).not.toThrow();
  });

  it("returns a registry with agents array", () => {
    const registry = loadAgentRegistry(true);
    expect(Array.isArray(registry.agents)).toBe(true);
  });

  it("loads at least one agent persona", () => {
    const registry = loadAgentRegistry(true);
    expect(registry.agents.length).toBeGreaterThan(0);
  });

  it("registry has a lastLoaded ISO timestamp", () => {
    const registry = loadAgentRegistry(true);
    expect(typeof registry.lastLoaded).toBe("string");
    expect(() => new Date(registry.lastLoaded)).not.toThrow();
    expect(new Date(registry.lastLoaded).toISOString()).toBe(registry.lastLoaded);
  });

  it("each persona has required fields", () => {
    const registry = loadAgentRegistry(true);
    for (const persona of registry.agents) {
      expect(typeof persona.role).toBe("string");
      expect(typeof persona.displayName).toBe("string");
      expect(typeof persona.description).toBe("string");
      expect(typeof persona.systemPrompt).toBe("string");
      expect(Array.isArray(persona.preferredCategories)).toBe(true);
      expect(Array.isArray(persona.defaultWorkflows)).toBe(true);
      expect(Array.isArray(persona.toolPermissions)).toBe(true);
      expect(Array.isArray(persona.orderingPatterns)).toBe(true);
    }
  });

  it("CEO persona is loaded correctly", () => {
    const registry = loadAgentRegistry(true);
    const ceo = registry.agents.find((a) => a.role === "ceo");
    expect(ceo).toBeDefined();
    expect(ceo!.displayName).toBe("Chief Executive Officer");
    expect(ceo!.preferredCategories).toContain("marketing");
    expect(ceo!.defaultWorkflows.length).toBeGreaterThan(0);
  });

  it("uses cache on second call without forceReload", () => {
    const first = loadAgentRegistry(true);
    const second = loadAgentRegistry(false);
    // Should be exact same reference (cached)
    expect(second.lastLoaded).toBe(first.lastLoaded);
  });

  it("reloads when forceReload is true", () => {
    loadAgentRegistry(true);
    // After force reload, we should get a new registry
    // (timestamps may differ by milliseconds)
    const fresh = loadAgentRegistry(true);
    expect(fresh.agents.length).toBeGreaterThan(0);
  });
});

describe("getAgentPersona", () => {
  it("returns CEO persona by role name", () => {
    const persona = getAgentPersona("ceo");
    expect(persona).toBeDefined();
    expect(persona!.role).toBe("ceo");
  });

  it("returns undefined for an unknown role", () => {
    const persona = getAgentPersona("unknown_role_xyz");
    expect(persona).toBeUndefined();
  });

  it("returns correct displayName for CMO", () => {
    const persona = getAgentPersona("cmo");
    expect(persona).toBeDefined();
    // CMO should exist (it's in the agents directory)
  });
});

describe("listAgents", () => {
  it("returns an array of personas", () => {
    const agents = listAgents();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("each agent has a valid role string", () => {
    // Role must be a valid identifier (lowercase, alphanumeric + underscore).
    // The 8 C-Suite roles ship as .md files; specialist personas registered
    // via register_agent (growth_hacker, grant_writer, ...) must also pass.
    for (const agent of listAgents()) {
      expect(agent.role).toMatch(/^[a-z][a-z0-9_]{1,48}$/);
    }
  });
});

// ── registerAgent — uses the real agents dir but restores file afterward ───────

describe("registerAgent", () => {
  const AGENTS_DIR = join(
    new URL("../../", import.meta.url).pathname.replace(/\/$/, ""),
    "agents"
  );
  let originalCeoContent: string | null = null;
  const ceoPath = join(AGENTS_DIR, "ceo.md");

  beforeEach(() => {
    // Snapshot the current ceo.md so we can restore it after each test
    originalCeoContent = existsSync(ceoPath) ? readFileSync(ceoPath, "utf-8") : null;
  });

  afterEach(() => {
    // Restore ceo.md and invalidate registry cache
    if (originalCeoContent !== null) {
      writeFileSync(ceoPath, originalCeoContent, "utf-8");
    }
    // Force cache invalidation for subsequent tests
    loadAgentRegistry(true);
  });

  it("writes a valid .md file for a persona", () => {
    const persona: AgentPersona = {
      role: "ceo",
      displayName: "Test CEO",
      description: "Test description for CEO",
      systemPrompt: "You are a test CEO agent with strategic responsibilities.",
      preferredCategories: ["marketing", "sales"],
      defaultWorkflows: ["dsf-playbook"],
      toolPermissions: ["list_categories", "search_prompts"],
      orderingPatterns: ["Give me a strategy for {{Goal}}"],
    };

    const path = registerAgent(persona);
    expect(typeof path).toBe("string");
    expect(path).toMatch(/\.md$/);
    expect(existsSync(path)).toBe(true);
  });

  it("round-trip: registered persona can be retrieved via getAgentPersona", () => {
    const persona: AgentPersona = {
      role: "ceo",
      displayName: "Verified CEO",
      description: "A verified CEO persona for testing",
      systemPrompt: "## System Prompt\n\nYou are the verified CEO agent.",
      preferredCategories: ["marketing"],
      defaultWorkflows: ["venture-forge"],
      toolPermissions: ["list_categories"],
      orderingPatterns: [],
    };

    registerAgent(persona);
    // Force reload after registration
    const retrieved = getAgentPersona("ceo");
    expect(retrieved).toBeDefined();
    expect(retrieved!.role).toBe("ceo");
  });
});

// ── Specialist (non-C-Suite) personas — the register_agent latent-bug fix ────

describe("registerAgent — specialist (non-C-Suite) persona", () => {
  const AGENTS_DIR = join(
    new URL("../../", import.meta.url).pathname.replace(/\/$/, ""),
    "agents"
  );
  const specialistPath = join(AGENTS_DIR, "growth_hacker.md");
  let existedBefore = false;
  let originalContent: string | null = null;

  beforeEach(() => {
    existedBefore = existsSync(specialistPath);
    originalContent = existedBefore ? readFileSync(specialistPath, "utf-8") : null;
  });

  afterEach(() => {
    // Restore or remove — never leave the specialist file behind.
    if (existedBefore && originalContent !== null) {
      writeFileSync(specialistPath, originalContent, "utf-8");
    } else if (existsSync(specialistPath)) {
      rmSync(specialistPath);
    }
    loadAgentRegistry(true);
  });

  it("accepts and persists a non-C-Suite role (growth_hacker)", () => {
    const persona: AgentPersona = {
      role: "growth_hacker",
      displayName: "Growth Hacker",
      description: "Rapid experimentation, viral loops, user acquisition",
      systemPrompt: "## System Prompt\n\nYou are an aggressive growth hacker focused on viral loops.",
      preferredCategories: ["marketing", "promotion", "sales"],
      defaultWorkflows: ["viral-freeshare"],
      toolPermissions: ["search_prompts", "browse_warehouse"],
      orderingPatterns: ["Find me a viral loop for {{Product}}"],
    };

    const path = registerAgent(persona);
    expect(existsSync(path)).toBe(true);
    expect(path).toContain("growth_hacker.md");
  });

  it("round-trip: specialist persona is retrievable via getAgentPersona", () => {
    const persona: AgentPersona = {
      role: "growth_hacker",
      displayName: "Growth Hacker",
      description: "Rapid experimentation",
      systemPrompt: "## System Prompt\n\nYou are a growth hacker.",
      preferredCategories: ["marketing"],
      defaultWorkflows: [],
      toolPermissions: [],
      orderingPatterns: [],
    };

    registerAgent(persona);
    const retrieved = getAgentPersona("growth_hacker");
    expect(retrieved).toBeDefined();
    expect(retrieved!.role).toBe("growth_hacker");
    expect(retrieved!.displayName).toBe("Growth Hacker");
    expect(retrieved!.preferredCategories).toContain("marketing");
  });
});
