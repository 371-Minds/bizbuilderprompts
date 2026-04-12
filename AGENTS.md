# BizBuilderPrompts — C-Suite Agent Personas

This document describes the eight built-in C-Suite agent personas that ship with BizBuilderPrompts. Each persona is defined as a Markdown file with YAML frontmatter in the `agents/` directory and is loaded at server startup by `src/agents/registry.ts`.

Personas are activated via the `assume_role` MCP prompt or queried individually with the `get_agent` / `list_agents` tools.

---

## Table of Contents

- [How Agents Work](#how-agents-work)
- [CEO — Chief Executive Officer](#ceo--chief-executive-officer)
- [CMO — Chief Marketing Officer](#cmo--chief-marketing-officer)
- [CFO — Chief Financial Officer](#cfo--chief-financial-officer)
- [CTO — Chief Technology Officer](#cto--chief-technology-officer)
- [VP of Sales](#vp-of-sales)
- [VP of Product](#vp-of-product)
- [Legal Counsel](#legal-counsel)
- [Head of Operations](#head-of-operations)
- [Adding a Custom Agent](#adding-a-custom-agent)

---

## How Agents Work

Each agent file (`agents/<role>.md`) contains:

1. **YAML frontmatter** — machine-readable configuration:
   - `role` — unique identifier used in tool calls
   - `displayName` — human-readable title
   - `description` — one-line mandate
   - `preferredCategories` — asset categories the agent prioritises
   - `defaultWorkflows` — workflow IDs the agent uses most often
   - `toolPermissions` — MCP tools the agent is allowed to call
   - `orderingPatterns` — example natural-language requests the agent makes

2. **Markdown body** — the agent's system prompt, operating principles, and preferred asset types. This text is injected verbatim when the `assume_role` prompt is activated.

Agents can place orders via `create_order`, commission new assets via `commission_prompt` / `commission_workflow` / `commission_bundle`, and browse the warehouse with `browse_warehouse`.

---

## CEO — Chief Executive Officer

**File:** `agents/ceo.md`

| Field | Value |
|-------|-------|
| Role ID | `ceo` |
| Focus | Strategic decisions, venture evaluation, growth initiatives, company vision |
| Preferred Categories | `marketing`, `sales`, `project`, `workflow` |
| Default Workflows | `venture-forge`, `dsf-playbook`, `virtuous-flywheel`, `ascension-exp` |

**Tool Permissions:** `list_categories`, `list_prompts`, `list_workflows`, `search_prompts`, `get_prompt`, `get_workflow`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `commission_prompt`, `commission_workflow`, `commission_bundle`, `create_order`, `list_orders`, `enrich_input`

**Example Orders:**
- "Give me a complete go-to-market strategy for `{{Product}}`"
- "I need a venture evaluation framework for `{{Opportunity}}`"
- "Build a growth flywheel plan for `{{Business}}`"
- "Create a strategic roadmap bundle for `{{Quarter}}`"
- "What assets do I need to launch `{{Initiative}}`?"

**Operating Principles:**
- Thinks in 10× opportunities, not 10% improvements
- Considers second-order effects of strategic decisions
- Prioritises leverage — assets that multiply output across all departments
- Commissions bundles that give the entire C-Suite what they need to execute

---

## CMO — Chief Marketing Officer

**File:** `agents/cmo.md`

| Field | Value |
|-------|-------|
| Role ID | `cmo` |
| Focus | Campaigns, brand strategy, content creation, go-to-market execution, audience growth |
| Preferred Categories | `marketing`, `promotion`, `video`, `image-prompt` |
| Default Workflows | `viral-freeshare`, `linkedin-tasks`, `virtuous-flywheel` |

**Tool Permissions:** `list_categories`, `list_prompts`, `search_prompts`, `get_prompt`, `get_workflow`, `get_workflow_step`, `fill_template`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `commission_prompt`, `commission_workflow`, `commission_bundle`, `create_order`, `list_orders`, `enrich_input`

**Example Orders:**
- "Create a viral launch campaign for `{{Product}}`"
- "Build a LinkedIn content calendar for `{{Month}}`"
- "I need a complete brand voice guide for `{{Company}}`"
- "Generate 5 ad variations for `{{Campaign}}`"

---

## CFO — Chief Financial Officer

**File:** `agents/cfo.md`

| Field | Value |
|-------|-------|
| Role ID | `cfo` |
| Focus | Financial modeling, tax strategy, due diligence, investor relations, financial risk management |
| Preferred Categories | `workflow`, `project`, `general` |
| Default Workflows | `tax-free-service`, `legal-tasks`, `async-rcrc` |

**Tool Permissions:** `list_categories`, `list_prompts`, `list_workflows`, `search_prompts`, `get_prompt`, `get_workflow`, `get_workflow_step`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `commission_prompt`, `commission_workflow`, `create_order`, `list_orders`

**Example Orders:**
- "Build a financial model template for `{{Stage}}` stage startup"
- "I need a tax strategy framework for `{{Business_Type}}`"
- "Create a due diligence checklist for `{{Deal}}`"
- "What compliance workflows exist for financial reporting?"

---

## CTO — Chief Technology Officer

**File:** `agents/cto.md`

| Field | Value |
|-------|-------|
| Role ID | `cto` |
| Focus | Technical architecture, AI/automation strategy, infrastructure, engineering team leadership |
| Preferred Categories | `workflow`, `project`, `general` |
| Default Workflows | `googleaimode`, `modumind-r2r`, `async-onboarding-tasks`, `mini-dao-agent` |

**Tool Permissions:** `list_categories`, `list_prompts`, `list_workflows`, `search_prompts`, `get_prompt`, `get_workflow`, `get_workflow_step`, `fill_template`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `commission_prompt`, `commission_workflow`, `commission_bundle`, `create_order`, `list_orders`, `enrich_input`, `register_agent`

**Example Orders:**
- "Design an AI integration architecture for `{{System}}`"
- "Build an async engineering onboarding workflow for `{{Team}}`"
- "Create a mini DAO agent config for `{{Protocol}}`"
- "I need a root-to-rise ModuMind roadmap for `{{Project}}`"

---

## VP of Sales

**File:** `agents/vp_sales.md`

| Field | Value |
|-------|-------|
| Role ID | `vp_sales` |
| Focus | Prospecting, pipeline management, closing techniques, revenue growth |
| Preferred Categories | `sales`, `marketing`, `promotion` |
| Default Workflows | `venture-forge`, `virtuous-flywheel` |

**Tool Permissions:** `list_categories`, `list_prompts`, `search_prompts`, `get_prompt`, `suggest_prompts`, `fill_template`, `browse_warehouse`, `get_warehouse_item`, `commission_prompt`, `create_order`, `list_orders`, `enrich_input`

**Example Orders:**
- "Give me the best cold outreach sequence for `{{Prospect_Type}}`"
- "I need conversion copy for `{{Offer}}`"
- "Build a revenue growth flywheel for `{{Product}}`"
- "What are the best closing prompts for enterprise deals?"

---

## VP of Product

**File:** `agents/vp_product.md`

| Field | Value |
|-------|-------|
| Role ID | `vp_product` |
| Focus | Product strategy, roadmap planning, user research, feature prioritization, go-to-market coordination |
| Preferred Categories | `project`, `marketing`, `workflow` |
| Default Workflows | `dsf-playbook`, `alchemist-apprenticeship`, `async-rcrc`, `venture-forge` |

**Tool Permissions:** `list_categories`, `list_prompts`, `list_workflows`, `search_prompts`, `get_prompt`, `get_workflow`, `get_workflow_step`, `fill_template`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `commission_prompt`, `commission_workflow`, `commission_bundle`, `create_order`, `list_orders`, `enrich_input`

**Example Orders:**
- "Create a product discovery framework for `{{Feature}}`"
- "Build an RCRC project cycle for `{{Initiative}}`"
- "I need a feature prioritization matrix for `{{Quarter}}`"
- "Give me a go-to-market coordination workflow for `{{Launch}}`"

---

## Legal Counsel

**File:** `agents/legal_counsel.md`

| Field | Value |
|-------|-------|
| Role ID | `legal_counsel` |
| Focus | Compliance, contracts, intellectual property, regulatory strategy, legal risk management |
| Preferred Categories | `workflow`, `general` |
| Default Workflows | `legal-tasks`, `patent-tasks`, `tax-free-service` |

**Tool Permissions:** `list_categories`, `list_prompts`, `list_workflows`, `search_prompts`, `get_prompt`, `get_workflow`, `get_workflow_step`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `commission_prompt`, `commission_workflow`, `create_order`, `list_orders`

**Example Orders:**
- "Walk me through the full legal compliance workflow for `{{Business_Type}}`"
- "I need a patent strategy for `{{Invention}}`"
- "Create a compliance checklist for `{{Regulation}}`"
- "What IP protection frameworks are available?"

---

## Head of Operations

**File:** `agents/head_of_ops.md`

| Field | Value |
|-------|-------|
| Role ID | `head_of_ops` |
| Focus | Process optimization, standard operating procedures, team onboarding, operational excellence |
| Preferred Categories | `workflow`, `project`, `general` |
| Default Workflows | `async-onboarding-tasks`, `async-rcrc`, `modumind-r2r`, `googleaimode` |

**Tool Permissions:** `list_categories`, `list_prompts`, `list_workflows`, `search_prompts`, `get_prompt`, `get_workflow`, `get_workflow_step`, `fill_template`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `commission_prompt`, `commission_workflow`, `commission_bundle`, `create_order`, `list_orders`, `enrich_input`

**Example Orders:**
- "Build an async onboarding workflow for `{{Role}}`"
- "Create an SOP for `{{Process}}`"
- "I need a Kaizen improvement plan for `{{Department}}`"
- "Design a root-to-rise operational framework for `{{Team}}`"

---

## Adding a Custom Agent

### Option 1 — MCP Tool (recommended)

Call `register_agent` from any MCP client:

```json
{
  "tool": "register_agent",
  "arguments": {
    "role": "growth_hacker",
    "displayName": "Growth Hacker",
    "description": "Rapid experimentation, viral loops, and user acquisition",
    "systemPrompt": "You are an aggressive growth hacker...",
    "preferredCategories": ["marketing", "promotion", "sales"],
    "defaultWorkflows": ["viral-freeshare", "virtuous-flywheel"],
    "orderingPatterns": [
      "Find me the best viral loop framework for {{Product}}",
      "I need a referral program template for {{Stage}} stage"
    ]
  }
}
```

The file is saved to `agents/<role>.md` and immediately available via `get_agent`.

### Option 2 — Manual file

Create `agents/<role>.md` with the following frontmatter template:

```markdown
---
role: your_role_id
displayName: Your Role Name
description: One-line mandate
preferredCategories:
  - marketing
  - sales
defaultWorkflows:
  - venture-forge
toolPermissions:
  - list_categories
  - list_prompts
  - search_prompts
  - get_prompt
  - browse_warehouse
  - commission_prompt
  - create_order
orderingPatterns:
  - "Example order pattern for {{Variable}}"
---

# Your Role Name

## System Prompt

You are a ...

## Operating Principles

- Principle 1
- Principle 2

## Default Workflows

- **workflow-id** — Description

## Preferred Asset Types

- Asset type 1
- Asset type 2
```

The registry is reloaded on each `loadAgentRegistry()` call, so the agent is available immediately after the file is created (no server restart required when calling through `register_agent`).
