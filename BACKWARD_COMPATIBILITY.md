# Backward Compatibility — protected surfaces

## MCP tool surface

All tools registered in `src/index.ts` (e.g. `list_prompts`, `get_prompt`, `list_workflows`, `search_prompts`, `suggest_prompts`, `browse_warehouse`, `get_warehouse_item`, `get_bundle`, `create_order`, `commission_*`, `register_agent`, `enrich_input`): names, argument schemas, and response shapes are consumed by external MCP clients — additive changes only.

## MCP prompts

`assume_role`, `get_agent`, `list_agents` and the agent persona contract (`agents/*.md` frontmatter parsed by `src/agents/registry.ts`).

## REST API (src/api-server.ts, :8003)

Existing routes and their JSON response shapes; new routes must follow the same patterns (structured errors, no stack-trace leakage).

## Data contracts

- `warehouse/index.json` (and per-item commerce/pricing config) — read by the server at runtime.
- `warehouse/sales.jsonl` — append-only sales ledger; new entries must keep the existing field order and never rewrite history.
- Bundle and category definitions under `src/`.

## Public site data

`.well-known/`, `README.md` documented endpoint behavior.
