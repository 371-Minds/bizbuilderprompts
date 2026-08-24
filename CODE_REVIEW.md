# Code Review Rules — bizbuilderprompts

Stack: TypeScript (ESM), Bun runtime, MCP server (`@modelcontextprotocol/sdk`), Zod schemas, Vitest tests, deployed as a systemd service (`bizbuilderprompts.service`, REST API on :8003 via Bun).

## Correctness

- Every code change ships with unit tests following the existing `src/__tests__/` patterns; `bunx vitest run` must pass.
- MCP tool and REST route changes must validate inputs with Zod or explicit guards before use.
- Warehouse data flows (index, readiness, pricing, commerce config) must stay consistent — check callers of any changed export in `src/`.

## Security

- Never commit secrets, wallet private keys, or `.env` content. `payTo` addresses are public data and safe to commit.
- Any outbound fetch must target a constant, allowlisted host — never a URL derived from user/request input.
- REST endpoints must return structured errors (404 unknown item, 409 invalid state) without leaking internal stack traces.

## Breaking changes

- The MCP tool surface (names, argument schemas, response shapes) and the REST API on :8003 are protected contracts — additive changes only; removals or renames require a migration note in the PR.
- Warehouse markdown files (`warehouse/`, `marketing/`, `sales/`, etc.) are data: don't reformat or rewrite unrelated items.

## Quality

- Follow existing route patterns in `src/api-server.ts`; no comments unless requested by convention (the repo is comment-light).
- Run the full gate: `bun run typecheck && bunx vitest run && bun run build`.
