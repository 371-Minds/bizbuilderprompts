# BizBuilderPrompts MCP Server

A curated library of **158+ business AI prompts, workflows, and templates** — exposed as a fully-featured [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server. Connect it to Claude Desktop, Cursor, Continue.dev, or any MCP-compatible AI client.

## What's Inside

| Category | Contents |
|----------|----------|
| **marketing** | Growth strategy, Kaizen, brand, idea validation |
| **sales** | Conversion copywriting, persuasion, closing techniques |
| **workflow** | 15 multi-step frameworks (legal, venture, project mgmt, DSF, DAO, etc.) |
| **image-prompt** | JSON specs for AI product image/video generation (Veo) — 9 products |
| **project** | 45+ startup and project idea blueprints |
| **promotion** | Ad copy, email hooks, promotional messages |
| **video** | Thumbnail and video content prompts |
| **general** | Game dev, patent/trademark prompts |

## Quick Start

### 1. Install & Build

```bash
bun install
bun run build
```

> **Requires:** [Bun](https://bun.sh) ≥ 1.0 (`curl -fsSL https://bun.sh/install | bash`). Node.js ≥ 18 is also supported for running the compiled output.

### 2. Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bizbuilderprompts": {
      "command": "bun",
      "args": ["/absolute/path/to/bizbuilderprompts/dist/index.js"]
    }
  }
}
```

**Config file locations:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

### 3. Connect to Cursor / Continue.dev

Use the same stdio transport. Point to `dist/index.js` as the command.

---

## MCP Tools (13 tools)

| Tool | Description |
|------|-------------|
| `list_categories` | Get all categories with prompt counts |
| `list_prompts` | List prompts with optional category/type/tag filters |
| `list_workflows` | List all multi-step workflows with step info |
| `search_prompts` | Fuzzy search by query text |
| `get_prompt` | Retrieve full content of any prompt by ID |
| `get_workflow` | Get a complete workflow (master + all steps) |
| `get_workflow_step` | Get a specific step within a workflow |
| `fill_template` | Fill `{{Variable}}` placeholders with your values |
| `suggest_prompts` | Get prompt suggestions for a goal or task description |
| `get_prompt_metadata` | Get metadata without full content |
| `list_ingestion_categories` | Show the full taxonomy of ingestible categories |
| `classify_prompt` | Dry-run: classify content without saving |
| `ingest_prompt` | Classify and optionally save a prompt to the right category |

## MCP Prompts (6 named prompts)

| Prompt | Description |
|--------|-------------|
| `business_copywriting` | Transform any text into high-converting copy (AIDA/PAS) |
| `kaizen_improvement` | Apply Kaizen philosophy to any business area |
| `run_workflow` | Execute any multi-step workflow with your context |
| `legal_compliance` | Legal & compliance framework for your business |
| `generate_image_prompt` | Create structured product image/video generation specs |
| `business_strategy` | Apply business strategy frameworks to your situation |

## MCP Resources

Every prompt file is available as a URI resource:

```
prompt://bizbuilderprompts/{category}/{id}
workflow://bizbuilderprompts/{workflowId}
workflow://bizbuilderprompts/{workflowId}/steps/{stepId}
image-prompt://bizbuilderprompts/{id}
project://bizbuilderprompts/{id}
```

---

## Example Agent Interactions

```
"Find me prompts for sales conversion"
→ search_prompts(query="sales conversion")

"Walk me through the legal compliance workflow for my SaaS"
→ run_workflow prompt with workflow_id="legal-tasks" and your context

"Improve my landing page copy"
→ business_copywriting prompt with your text

"What business frameworks are available?"
→ list_workflows()

"Get step 3 of the venture forge workflow"
→ get_workflow_step(workflow_id="venture-forge", step=3)

"I need to validate my business idea — what should I use?"
→ suggest_prompts(goal="validate business idea")
```

---

## Workflow IDs

| ID | Title | Steps |
|----|-------|-------|
| `alchemist-apprenticeship` | Alchemist Apprenticeship | 6 |
| `ascension-exp` | Ascension Experience | 4 |
| `async-onboarding-tasks` | Async Onboarding | 4 |
| `async-rcrc` | RCRC Project Cycle | 5 |
| `dsf-playbook` | DSF Tactical Playbook | 9 |
| `googleaimode` | Google AI Mode | 7 |
| `legal-tasks` | Legal & Compliance Guide | 7 |
| `linkedin-tasks` | LinkedIn Strategy | master only |
| `mini-dao-agent` | Mini DAO Agent | 5 |
| `modumind-r2r` | ModuMind Root-to-Rise | 5 |
| `patent-tasks` | Patent & Trademark | master only |
| `tax-free-service` | Tax-Free Service Strategy | 5 |
| `venture-forge` | Venture Forge | 5 |
| `viral-freeshare` | Viral Free Share | 5 |
| `virtuous-flywheel` | Virtuous Flywheel | 5 |

---

## Ingestion Agent

Drop new prompts into `incoming_prompts/` and run:

```bash
bun run ingest
```

The agent will:
1. Scan `incoming_prompts/` for `.md`, `.txt`, and `.json` files
2. Classify each file using keyword scoring and framework detection
3. Write it to the correct category directory
4. Rename the source file to `*.processed` to prevent re-processing
5. Warn when confidence is low so you can verify the category manually

You can also classify without saving via the MCP tool `classify_prompt`, or save via `ingest_prompt` directly from any MCP client.

**Detected framework patterns:** DSF (Discover/Space/Flow), RCRC, Kaizen, Alchemist, SYSTEM+USER, template variables (`{{Variable}}`), structured JSON.

---

## Development

```bash
bun run build      # Compile TypeScript → dist/
bun run typecheck  # Type-check without emitting
bun start          # Run the compiled server (stdio transport)
bun run dev        # Run directly from source with live-reload (no build needed)
bun run ingest     # Run the ingestion agent on incoming_prompts/
```

## Architecture

```
src/
  index.ts          # Entry point — stdio transport
  server.ts         # McpServer setup
  manifest.ts       # File scanner + in-memory prompt index
  resources.ts      # MCP Resource handlers (URI-addressable files)
  tools.ts          # MCP Tool handlers (13 callable functions)
  prompts.ts        # MCP Prompt handlers (6 named templates)
  types.ts          # TypeScript interfaces
  ingestion/
    types.ts        # Ingestion type definitions
    classifier.ts   # Keyword + framework classifier
    ingester.ts     # Ingestion logic + CLI entry point
  utils/
    template.ts     # {{Variable}} extraction and substitution
    search.ts       # Fuse.js fuzzy search + keyword suggestion
```

## License

MIT © 2025 KingLeoJr
