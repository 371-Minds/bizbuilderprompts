# TODO — BizBuilderPrompts

Living list of deferred work, known issues, and follow-ups. Updated 2026-07-16 after the methodology-extraction pipeline + persona-consolidation work.

---

## 🔴 Open bugs (external — not in this repo)

### Router `task_type` not persisted for some callers
- **Doc:** [`ROUTER_TASK_TYPE_BUG.md`](./ROUTER_TASK_TYPE_BUG.md) — full repro + diagnosis
- **Where to fix:** `/opt/371storage/projects/371-router/`
- **Impact:** Cost is still attributed correctly (via API key → `default`/`sk-371router`); only the `task_type`/`quality` labels are lost for pipeline calls. 2,611 / 3,622 historical rows *do* have `task_type`, so it works for some callers (Anton/mindsclip3) but not others.
- **Most likely cause (H1):** request body consumed twice — `c.req.json()` called in a middleware/cache-key builder before the main handler, leaving `body.task_type` undefined. See the doc's investigation steps.

---

## 🟡 Known issues (in-repo, acceptable for now)

### Pre-existing TypeScript errors in Bun-only scripts
- **Files:** `src/api-server.ts` (11 errors), `src/http-transport.ts` (6 errors)
- **Cause:** These files use `.ts` import extensions and `Bun.serve`, which `tsc` rejects by design. They run directly via `bun`, never compiled.
- **Impact:** `bun run typecheck` / `bun run build` exit non-zero, but `dist/` still emits correctly (errors don't block emission). The MCP entry point `dist/index.js` is unaffected.
- **Fix when:** If we want a clean `tsc` exit. Either add a separate `tsconfig` that excludes these two files, or add `@types/bun` + `allowImportingTsExtensions` for them only.

### `review_draft` depends on mindsclip3 (:7372) being up
- The C-Suite review gate calls the Board Meeting API. If mindsclip3 is down, `review_draft` fails gracefully with a clear "retry when back" message — but can't promote drafts.
- Extraction (`extract_methodology`) does NOT depend on mindsclip3 — only the review step does.

---

## 🔵 Deferred refactors

### Consolidate the 3 scattered role maps into one `affinities.ts`
- **Maps to merge:**
  - `ROLE_CATEGORY_AFFINITY` — `src/warehouse/catalog.ts:25` (8 keys)
  - `ROLE_ASSET_NEEDS` — `src/factory/bundle_creator.ts:33` (8 keys)
  - `getDefaultWorkflowsForRole` defaults — `src/factory/bundle_creator.ts:157` (8 keys)
- **Why deferred:** Not part of the soul-loading duplication removed in Phase 2. Consolidating touches the factory surface (bundle_creator) and is a separate, larger refactor.
- **Shape:** One `src/agents/affinities.ts` exporting `Record<CsuiteRole, { categories, workflows, assetNeeds }>` consumed by all three call sites.

### Wire the 9 duplicated `z.enum([...8 roles...])` to a shared constant
- **Sites:** `src/tools.ts` (7), `src/prompts.ts` (2) — all hardcode the same 8-role literal.
- **Why deferred:** They correctly constrain the C-Suite ordering/commissioning surface (specialists don't order). A shared `CSUITE_ROLE_ENUM` would DRY them but isn't urgent.
- **Fix:** Export `CSUITE_ROLES` array from `src/agents/types.ts`, use `z.enum(CSUITE_ROLES)` at each site.

---

## 🟢 Feature follow-ups

### IPFS pinning of extracted assets (synchronous)
- **Current:** Assets written to `warehouse/prompts/` are queryable via `browse_warehouse`. IPFS pin + B2 archive happen *if* the warehouse dir is RTS-watched.
- **Follow-up:** Call `/opt/371storage/rts-triggers/rootlift-pin.sh` explicitly from `src/pipeline/index.ts` after each write, so the content hash is pinned synchronously rather than waiting for the watcher. Makes the provenance `sourceHash` immediately content-addressed.

### `review_draft` — capture reviewer rationale
- **Current:** Parses the final `VERDICT: APPROVE|REVISE|REJECT` line.
- **Follow-up:** Also extract and store each reviewer's reasoning (the transcript text between their turn and the verdict) into `WarehouseItem` metadata, so future audits can see *why* an asset was approved.

### Extracted-asset re-extraction
- **Current:** Re-running `extract_methodology` on the same source creates new drafts (with `_1`, `_2` filename suffixes via collision handling).
- **Follow-up:** Detect existing items with the same `provenance.sourceHash` + topic and offer an "update in place" path instead of duplicating.

### Pre-score tuning
- **Current:** Review threshold is hardcoded at 0.6 (`src/pipeline/extractor.ts`). The smoke run flagged a legitimate brand-color rule at 0.00 (correct) but also a real "Surgical Update Rule" at 0.42 (borderline).
- **Follow-up:** After ~50 real extractions, review the distribution and tune the threshold. Consider per-type thresholds (workflows vs prompts).

---

## ✅ Completed (2026-07-16)

- [x] **Methodology extraction pipeline** (`src/pipeline/`) — sovereign extraction via 371 Router, :8081 fallback, batched pre-score, provenance, draft→ready gate
- [x] **SSRF guard** on `enrich_input` (`src/utils/url-guard.ts`) — closes the C-Suite review's BLOCK-2
- [x] **Factory writes `status:"draft"`** — commissioned assets now go through the same review gate as extracted ones
- [x] **`provenance` field** on `WarehouseItem` — every extracted asset traces back to its source
- [x] **2 new MCP tools** — `extract_methodology` (29), `review_draft` (30). Tool count 28 → 30.
- [x] **Persona soul-loading machinery removed** — `CSUITE_MAP`, the Memoria SOUL.md prepend loop, and the `csuite?` field are gone. Personas are frontmatter-only.
- [x] **`register_agent` latent bug fixed** — `VALID_ROLES` widened to accept specialist personas (`growth_hacker`, `grant_writer`, etc.) as the tool always advertised.
- [x] **Tests** — 246 passing (was 244; +2 specialist-persona tests). Typecheck clean in all touched files.
- [x] **Docs** — README.md + AGENTS.md updated; ROUTER_TASK_TYPE_BUG.md written for the router fix.
