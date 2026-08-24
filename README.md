# BizBuilderPrompts MCP Server

A curated library of **158+ business AI prompts, workflows, and templates** — exposed as a fully-featured [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server with **30 tools**, **8 prompts**, a **Warehouse** asset catalog, an **Asset Factory**, a **Methodology Extraction pipeline**, a **Commerce layer**, and **8 C-Suite agent personas** (plus runtime-registerable specialist personas). Connect it to Claude Desktop, Cursor, Continue.dev, or any MCP-compatible AI client.

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

## MCP Tools (30 tools)

### Prompt Library

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

### Ingestion

| Tool | Description |
|------|-------------|
| `list_ingestion_categories` | Show the full taxonomy of ingestible categories |
| `classify_prompt` | Dry-run: classify content without saving |
| `ingest_prompt` | Classify and optionally save a prompt to the right category |

### Warehouse

| Tool | Description |
|------|-------------|
| `browse_warehouse` | Browse the asset warehouse; filter by role, category, or status |
| `get_warehouse_item` | Retrieve the full content of a warehouse asset by ID |
| `get_bundle` | Return all assets in a named warehouse bundle |

### Agents

| Tool | Description |
|------|-------------|
| `list_agents` | List all registered agent personas (8 C-Suite + any specialists) |
| `get_agent` | Get the full persona definition for a role |
| `register_agent` | Create a custom agent persona and save it to `agents/` — works for both C-Suite roles and specialist personas (e.g. `growth_hacker`, `grant_writer`) |

### Methodology Extraction

| Tool | Description |
|------|-------------|
| `extract_methodology` | Extract reusable methodologies & decision frameworks from source text via the 371 Router. Saves assets to the warehouse as drafts with provenance (source hash + verification quote) and a fidelity pre-score. |
| `review_draft` | Submit a draft asset to the C-Suite Board Meeting API (mindsclip3 :7372). Rune checks fidelity, Alex checks license/IP. On APPROVE the draft is promoted to ready. |

### Asset Factory

| Tool | Description |
|------|-------------|
| `commission_prompt` | Generate a new structured prompt asset (optionally save to warehouse) |
| `commission_workflow` | Generate a new multi-step workflow asset (DSF/RCRC/Kaizen/Alchemist) |
| `commission_bundle` | Package multiple assets into a named bundle |
| `enrich_input` | Enrich raw text/URL/file/transcript before commissioning |

### Orders

| Tool | Description |
|------|-------------|
| `create_order` | C-Suite agent submits an asset order; fulfillment searches existing assets and flags gaps |
| `get_order` | Retrieve the status and details of an order by ID |
| `list_orders` | List all orders, optionally filtered by role |

### Commerce

| Tool | Description |
|------|-------------|
| `set_item_pricing` | Configure pricing and payment options (x402/Creem/Polar/Mercury) for a warehouse item |
| `get_item_pricing` | Retrieve pricing, product ID, keywords, and storefront card for a warehouse item |

## MCP Prompts (8 named prompts)

| Prompt | Description |
|--------|-------------|
| `business_copywriting` | Transform any text into high-converting copy (AIDA/PAS) |
| `kaizen_improvement` | Apply Kaizen philosophy to any business area |
| `run_workflow` | Execute any multi-step workflow with your context |
| `legal_compliance` | Legal & compliance framework for your business |
| `generate_image_prompt` | Create structured product image/video generation specs |
| `business_strategy` | Apply business strategy frameworks to your situation |
| `assume_role` | Activate a C-Suite agent persona for the session |
| `order_from_warehouse` | Guided ordering experience — describe what you need and get a fulfillment plan |

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

## C-Suite Agent Personas

Eight built-in agent personas live in `agents/*.md`. Each defines a role, system prompt, preferred asset categories, default workflows, and example ordering patterns. Activate them with the `assume_role` prompt or query them with `get_agent`.

Personas are defined entirely by their `.md` frontmatter + body — no external soul files are loaded. The 8 C-Suite roles can be extended at runtime with **specialist personas** (e.g. `growth_hacker`, `grant_writer`, `housing_sme`) via `register_agent`; these load through the same registry and appear in `list_agents` alongside the C-Suite roles.

| Role | Display Name | Focus |
|------|-------------|-------|
| `ceo` | Chief Executive Officer | Strategy, venture evaluation, growth initiatives |
| `cmo` | Chief Marketing Officer | Campaigns, brand, content, go-to-market |
| `cfo` | Chief Financial Officer | Financial modeling, tax strategy, due diligence |
| `cto` | Chief Technology Officer | Architecture, AI/automation, engineering leadership |
| `vp_sales` | VP of Sales | Prospecting, pipeline, closing, revenue growth |
| `vp_product` | VP of Product | Roadmap, user research, feature prioritization |
| `legal_counsel` | Legal Counsel | Compliance, contracts, IP, regulatory strategy |
| `head_of_ops` | Head of Operations | SOPs, onboarding, process optimization |

See **[AGENTS.md](./AGENTS.md)** for full persona specs, tool permissions, and ordering patterns.

---

## Warehouse

The `warehouse/` directory is an in-server asset catalog populated by the Asset Factory. Items are categorized as `prompt`, `workflow`, `image-spec`, `agent-config`, or `bundle` and can carry commerce metadata (pricing, payment provider config).

```
warehouse/
  prompts/          # Commissioned prompt assets
  workflows/        # Commissioned workflow assets
  bundles/          # Named asset collections
  agent-configs/    # Custom agent definitions
  image-specs/      # Veo-compatible image/video specs
  index.json        # Catalog index (auto-managed)
```

Use `browse_warehouse` to search, `get_warehouse_item` to fetch, and `commission_*` tools to create new assets.

**Item status lifecycle:** `draft` → `ready` → `featured`. Commissioned and extracted assets land as `draft`; `review_draft` promotes them to `ready` after C-Suite sign-off. Extracted assets additionally carry a `provenance` block (`sourceLabel`, `sourceHash`, `extractedAt`, `model`) so any claim in the asset body can be verified against the original source.

---

## Asset Factory

The factory (`src/factory/`) generates structured assets server-side — no LLM calls required:

| Generator | Tool | Output |
|-----------|------|--------|
| `craftPrompt()` | `commission_prompt` | Structured prompt with `{{Variables}}`, output sections, role framing |
| `designWorkflow()` | `commission_workflow` | Multi-step workflow (DSF / RCRC / Kaizen / Alchemist) |
| `buildImageSpec()` | (internal) | Veo-compatible JSON image/video spec |
| `createBundle()` | `commission_bundle` | Named bundle of related assets |

Enrich raw input first with `enrich_input` to get better topic detection, entity extraction, and language detection before commissioning.

---

## Methodology Extraction Pipeline

The pipeline (`src/pipeline/`) turns source text (PLR, research docs, CORTEX convos, existing prompts) into concrete warehouse assets via the **371 Router** (:3000) — sovereign, no external LLM. Every extracted asset carries provenance so any claim can be verified against its source.

```
source text (or local file path)
  │
  ▼  extract_methodology
371 Router → structured methodologies (concrete content, no {{placeholders}})
  │   each item: { topic, goal, content, framework, tags, sourceQuote, confidence }
  ▼
batched pre-score (Rune's fidelity rubric) → flag low-confidence items
  ▼
write to warehouse/ as status:"draft" + provenance{ sourceLabel, sourceHash, model }
  ▼
review_draft → mindsclip3 Board Meeting (Rune + Alex) → draft:"ready"
```

**Key properties:**
- **Sovereign:** all inference through `localhost:3000` (DeepSeek/Z.AI), cost attributed to `bizbuilder-mgr`. Automatic fallback to the local fast model (:8081, LFM2.5-1.2B) if the router is down — fallback output is marked so reviewers know it's degraded.
- **Concrete, not templated:** extracted content is ready-to-use — never `{{variable}}` scaffolds (the factory's crafters already do that job).
- **Verifiable:** every asset stores a SHA-256 of its source + a verbatim `sourceQuote` showing where the methodology came from.
- **Gated:** assets land as `draft`; the pre-score flags low-fidelity items for mandatory review; `review_draft` promotes to `ready` only on C-Suite APPROVE.

The pipeline is the repo's first and only LLM client — see `src/pipeline/router-client.ts`. SSRF-guarded URL fetching (`src/utils/url-guard.ts`) protects the `enrich_input` path.

---

## Commerce Layer

Each warehouse item can carry a `commerce` block with one or more payment providers:

| Provider | Description |
|----------|-------------|
| **x402** | HTTP 402 micropayments — `X-PAYMENT-REQUIRED` header, Base blockchain |
| **Creem** | Checkout URL + `CREEM_API_KEY` env var |
| **Polar** | Organization slug + product ID + `POLAR_API_KEY` env var |
| **Mercury** | Treasury account + configurable API key env var |

Use `set_item_pricing` to configure and `get_item_pricing` to retrieve pricing details and a ready-made storefront card.

### x402 Purchase Endpoints (REST API, :8003)

The REST server exposes the x402 purchase flow for any warehouse item that is `ready`/`featured` and carries an enabled x402 config:

**`GET /warehouse/buy/:id` — purchase offer**

Returns `402 Payment Required` with the machine-readable `X-PAYMENT-REQUIRED` header (base64-encoded payment requirements, per the [x402 protocol](https://x402.org)) plus a JSON body:

```json
{
  "error": "X402 Payment Required",
  "storefrontCard": { "id": "...", "title": "...", "msrpDisplay": "$29.00", "isForSale": true },
  "payment": {
    "priceDisplay": "$3.00 USDC",
    "asset": "USDC",
    "network": "base",
    "paymentType": "one-time",
    "payTo": "0x...",
    "howToPay": "Pay $3.00 USDC to unlock this asset. ..."
  }
}
```

Errors: `404` unknown item, `409` item not for sale via x402 or not ready.

**`POST /warehouse/buy/:id` — settlement**

The client pays per the header (exact scheme, USDC on Base) and retries with the base64 payment payload in the `X-PAYMENT` header. The server verifies it against an allowlisted x402 facilitator (`POST /verify`, x402 v1 contract). On success it returns the full asset markdown and records the sale:

```json
{
  "itemId": "...",
  "title": "...",
  "sale": { "ts": "...", "itemId": "...", "amount": 3000000, "asset": "USDC", "txHash": "0x...", "network": "base" },
  "content": "# Full asset markdown ..."
}
```

Every verified sale is appended to `warehouse/sales.jsonl` (`{ts, itemId, title, amount, asset, txHash, network}`) and a `warehouse.sale` event is fired to Interbeing (`127.0.0.1:3710/api/events`, source `bizbuilderprompts`) fire-and-forget.

Failures return `402` with a clear reason: missing/invalid `X-PAYMENT` header, facilitator rejection, or facilitator unreachable.

The facilitator is fetch-guarded: the base URL is resolved once at boot from a constant allowlist (`https://api.cdp.coinbase.com/platform/v1/x402`, `https://x402.org`); `X402_FACILITATOR_URL` may override it only if the host is allowlisted, http/https only — request input can never steer the outbound fetch.

---

## Akash Deployment

Deploy the server on [Akash Network](https://akash.network) (decentralized cloud) using the included SDL:

```bash
# Build the Docker image first
docker build -t bizbuilderprompts-mcp:latest .

# Push to a registry (e.g. Docker Hub)
docker tag bizbuilderprompts-mcp:latest yourdockerhub/bizbuilderprompts-mcp:latest
docker push yourdockerhub/bizbuilderprompts-mcp:latest

# Deploy via Akash CLI
provider-services tx deployment create deploy.yaml --from <your-wallet>
```

See **[deploy.yaml](./deploy.yaml)** for the full SDL spec.

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
npm test           # Run the full test suite (vitest)
npm run test:watch # Run tests in watch mode during development
```

## Testing

The project uses [Vitest](https://vitest.dev) for unit testing. Tests live in `src/__tests__/` alongside the source modules they cover.

### Running Tests

```bash
npm test           # Run all tests once
npm run test:watch # Watch mode for development
```

> **Requires:** Node.js ≥ 18 (or Bun ≥ 1.0). Vitest is installed as a dev dependency.

### Test Coverage

| Module | Test File | What's Covered |
|--------|-----------|----------------|
| `src/utils/template.ts` | `utils.template.test.ts` | `extractVariables`, `fillTemplate` — placeholder parsing, deduplication, underscore fallback, unfilled tracking |
| `src/utils/search.ts` | `utils.search.test.ts` | `buildSearchIndex`, `searchPrompts`, `suggestPrompts` — fuzzy search, scoring, excerpts, keyword ranking |
| `src/ingestion/classifier.ts` | `ingestion.classifier.test.ts` | `classify` — all category types, framework detection (DSF/RCRC/Kaizen/Alchemist/template/structured), variable extraction, filename suggestions |
| `src/agents/registry.ts` | `agents.registry.test.ts` | `loadAgentRegistry`, `getAgentPersona`, `listAgents`, `registerAgent` — YAML parsing, round-trip registration, cache behavior |
| `src/commerce/config.ts` | `commerce.config.test.ts` | `formatMsrp`, `formatX402Price`, `buildX402PaymentRequiredHeader`, `decodeX402Header`, `buildStorefrontCard`, `validateCommerceConfig` — all payment providers, address resolution, error accumulation |
| `src/enrichment/extractor.ts` | `enrichment.extractor.test.ts` | `enrichInput` — text/file/transcript types, topic detection, entity extraction, language detection, filler word removal |
| `src/factory/prompt_crafter.ts` | `factory.prompt_crafter.test.ts` | `craftPrompt` — role assignment, category inference, framework labels, output sections, audience/style/context handling |
| `src/warehouse/catalog.ts` | `warehouse.catalog.test.ts` | `generateProductId`, `searchWarehouse`, `addToWarehouse`, `getWarehouseItemById`, `addBundle`, `getBundle`, `listBundles` — CRUD, filtering by role/category/status/query, deduplication |
| `src/pipeline/extractor.ts` + `src/utils/url-guard.ts` | `pipeline.extractor.test.ts` | Extraction contract (concrete content, mandatory sourceQuote, no `{{}}`), JSON parsing robustness (fences/bare arrays/malformed items dropped), pre-score parsing, SSRF guard (private IP ranges, loopback, link-local, CGNAT/Tailscale) |

### Writing New Tests

Follow the pattern established in `src/__tests__/`. Each test file:
- Imports from the source module using relative paths with `.js` extension (required for ESM)
- Uses `describe` / `it` / `expect` from `vitest`
- Uses `beforeEach` / `afterEach` when tests mutate shared state (e.g., file system, module cache)

Example:

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../myModule.js";

describe("myFunction", () => {
  it("does the expected thing", () => {
    expect(myFunction("input")).toBe("expected output");
  });
});
```

## Architecture

```
src/
  index.ts          # Entry point — stdio transport
  server.ts         # McpServer setup
  manifest.ts       # File scanner + in-memory prompt index
  resources.ts      # MCP Resource handlers (URI-addressable files)
  tools.ts          # MCP Tool handlers (30 callable functions)
  prompts.ts        # MCP Prompt handlers (8 named templates)
  types.ts          # TypeScript interfaces
  agents/
    registry.ts     # Persona loader + YAML parser (C-Suite + specialists)
    types.ts        # Agent type definitions (CsuiteRole union kept for ordering surface)
  commerce/
    config.ts       # x402 / Creem / Polar / Mercury payment helpers
    types.ts        # Commerce type definitions
  enrichment/
    extractor.ts    # Raw input enrichment (URL/text/file/transcript) — SSRF-guarded
    types.ts        # Enrichment type definitions
  factory/
    generator.ts    # Asset factory dispatcher (writes status:"draft")
    prompt_crafter.ts  # Structured prompt generation
    workflow_architect.ts  # Multi-step workflow generation
    image_spec_builder.ts  # Veo image spec generation
    bundle_creator.ts  # Bundle composition
    types.ts        # Factory type definitions
  ingestion/
    types.ts        # Ingestion type definitions
    classifier.ts   # Keyword + framework classifier
    ingester.ts     # Ingestion logic + CLI entry point
  orders/
    fulfiller.ts    # Order fulfillment logic
    manager.ts      # Order state management
    types.ts        # Order type definitions
  pipeline/         # Methodology extraction pipeline (sovereign, via 371 Router)
    router-client.ts   # The repo's only LLM client → :3000, fallback :8081
    extractor.ts       # Extraction prompt + robust JSON parsing + pre-score
    index.ts           # extractAndSave orchestration → warehouse drafts
    review.ts          # C-Suite review gate (mindsclip3 Board Meeting API)
    types.ts           # Provenance, ExtractedAsset, ExtractionResult
  utils/
    template.ts     # {{Variable}} extraction and substitution
    search.ts       # Fuse.js fuzzy search + keyword suggestion
    url-guard.ts    # SSRF guard — blocks private/loopback/link-local fetches
  warehouse/
    catalog.ts      # Warehouse catalog CRUD + search
    types.ts        # Warehouse type definitions (incl. provenance field)
  __tests__/
    utils.template.test.ts
    utils.search.test.ts
    ingestion.classifier.test.ts
    agents.registry.test.ts
    commerce.config.test.ts
    enrichment.extractor.test.ts
    factory.prompt_crafter.test.ts
    pipeline.extractor.test.ts
    warehouse.catalog.test.ts
```

## License

MIT © 2025 KingLeoJr
