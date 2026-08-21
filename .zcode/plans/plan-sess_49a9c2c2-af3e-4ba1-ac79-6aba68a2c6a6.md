# Persona Consolidation — Phase 2

## Goal
Remove the dead C-Suite soul-loading machinery (the real duplication: Memoria souls loaded in two places) and fix the latent `register_agent` bug that silently rejects specialist personas. **Keep the 8 `.md` files** — they provide identity (`systemPrompt`, `displayName`, `orderingPatterns`) that `assume_role` injects into sessions and that no affinity map can replace.

## Decisions (from your answers)
- **Identity:** keep the 8 `.md` files. Delete only the soul-loading machinery.
- **register_agent:** widen `VALID_ROLES` so specialist personas actually work.

This is the lowest-risk option: ~6 surgical edits across 3 files, the 30-tool surface stays intact, existing persona assertions pass unchanged.

---

## Change 1 — `src/agents/registry.ts`: delete soul-loading loop + fix VALID_ROLES

**Edit 1a:** Remove the `CSUITE_MAP` import (line 5):
```ts
// DELETE:
import { CSUITE_MAP } from "./types.js";
```
Keep line 4's `import type { AgentPersona, AgentRegistry, CsuiteRole }` — `CsuiteRole` is still used for the cast at line 95.

**Edit 1b:** Delete the entire soul-loading `for` loop (lines 131–146):
```ts
// DELETE this whole block:
  // Attach C-Suite mappings and load soul files
  for (const persona of agents) {
    const mapping = CSUITE_MAP[persona.role];
    if (mapping) {
      persona.csuite = { ...mapping };
      try {
        const soulContent = readFileSync(mapping.soulPath, "utf-8").trim();
        if (soulContent) {
          persona.systemPrompt = soulContent + "\n\n---\n\n## BizBuilder Asset Access\n\n" + persona.systemPrompt;
        }
      } catch {
        // Soul file not found — use BizBuilder system prompt as-is
      }
    }
  }
```
After deletion, `loadAgentRegistry` returns personas with frontmatter-only data — exactly what every runtime consumer actually reads (`fulfillOrder` reads `defaultWorkflows`; `assume_role` reads `systemPrompt`/`displayName`/`defaultWorkflows`/`preferredCategories`/`orderingPatterns`; all of those come from the `.md` frontmatter/body, not from the soul prepend).

**Edit 1c:** Widen `VALID_ROLES` (lines 10–13) so `register_agent` accepts specialist personas as its description promises:
```ts
// BEFORE: hardcoded 8-role gate
const VALID_ROLES = new Set<string>([
  "ceo", "cmo", "cfo", "cto",
  "vp_sales", "vp_product", "legal_counsel", "head_of_ops",
]);

// AFTER: accept any non-empty lowercase role id (specialist personas like
// growth_hacker, grant_writer, housing_sme now persist + load correctly).
// The 8 C-Suite roles remain valid; specialists are additive.
function isValidRole(role: string): boolean {
  return /^[a-z][a-z0-9_]{1,48}$/.test(role);
}
```
Then update `parseAgentFile`'s gate at line 82–83: `if (!VALID_ROLES.has(role)) return null;` → `if (!isValidRole(role)) return null;`

**Edit 1d:** Fix the cast at line 95 — `role: role as CsuiteRole` no longer holds for specialist roles. Widen `AgentPersona.role` to `string` (see Change 2) and drop the cast.

## Change 2 — `src/agents/types.ts`: remove `csuite` field + `CSUITE_MAP`; widen `role`

**Edit 2a:** Widen `AgentPersona.role` (line 12) from `CsuiteRole` to `string`:
```ts
export interface AgentPersona {
  role: string;   // was: CsuiteRole — now accepts specialist roles too
  ...
}
```
`CsuiteRole` stays exported (still used by `Order.requestedBy`, `searchWarehouse`, `WarehouseItem.targetRoles`, etc. — those are correct to keep constrained to the 8 roles since they're about C-Suite ordering, not arbitrary personas).

**Edit 2b:** Delete the `csuite?` field from `AgentPersona` (lines 20–27) — dead after Change 1b.

**Edit 2c:** Delete the entire `CSUITE_MAP` constant (lines 35–87, including the doc comment at line 35). Self-contained: only consumer was the deleted loop.

## Change 3 — `src/api-server.ts:227`: remove the dead `csuite` projection

The `/agents` endpoint projects `csuite: a.csuite ? {...} : undefined`. After Change 2b the field is gone. Remove that one line from the response object so it doesn't reference a non-existent property. (Note: `api-server.ts` is a Bun-only file with pre-existing tsc errors — but this is a real semantic fix, not a type cleanup.)

## Change 4 — `src/__tests__/agents.registry.test.ts`: relax the role-set assertion

**Edit 4a:** The test at lines 102–110 asserts every loaded agent's role is in the hardcoded 8-role set. After widening `VALID_ROLES`, a registered specialist (e.g. `growth_hacker`) would fail this. Relax to assert the role matches the `isValidRole` shape (`/^[a-z][a-z0-9_]{1,48}$/`) rather than a fixed set. The CEO/CMO-specific assertions (lines 51–58, 88–92) and the `registerAgent` round-trip (lines 137–172) pass unchanged because the 8 `.md` files are untouched.

**Add Edit 4b:** One new test asserting a specialist persona can be registered and retrieved (`registerAgent` with `role: "growth_hacker"` → `getAgentPersona("growth_hacker")` returns it), with snapshot/restore of any file written. This locks in the latent-bug fix.

---

## What stays untouched (and why)
- **The 8 `agents/*.md` files** — provide identity. `assume_role`, `get_agent`, `fulfillOrder`, `order_from_warehouse` all keep working as-is.
- **`CsuiteRole` type union** — still used by Order/Warehouse/Factory types for the 8-role ordering surface. Correctly constrained.
- **`ROLE_CATEGORY_AFFINITY` (catalog.ts), `ROLE_ASSET_NEEDS` + `getDefaultWorkflowsForRole` (bundle_creator.ts)** — the 3 scattered maps. Consolidating these is a *separate* refactor you didn't ask for; they're not part of the soul-loading duplication. Leaving them avoids touching the factory surface in this pass.
- **9 `z.enum([...8 roles...])` declarations** in tools.ts/prompts.ts — these gate which roles can *order/commission/assume*. Correctly stay constrained to C-Suite (specialist personas don't order; they're lenses). Leaving them.
- **AGENTS.md** — doesn't mention CSUITE_MAP/soul-loading (verified), so no doc edit required.

## Verification
- `bun run typecheck` — my files clean (api-server.ts keeps its pre-existing Bun errors, unchanged)
- `bun run test` — 244 tests pass (the role-set test relaxed in Edit 4a, +1 new specialist test in 4b → 245)
- Smoke: `list_agents` returns 8 personas with intact `systemPrompt`/`displayName`; `register_agent({role:"growth_hacker",...})` then `get_agent({role:"growth_hacker"})` returns it; `assume_role` for CEO still injects the full system prompt
- Sovereignty: unchanged — no new outbound surface; we're *removing* an absolute-path filesystem read (`/opt/371storage/.../SOUL.md`)

## Out of scope
- Consolidating the 3 scattered role maps into one `affinities.ts` (separate refactor)
- Widening the 9 `z.enum` role gates in tools.ts/prompts.ts (specialists don't order)
- OM VPS migration, IPFS pinning sync (parallel/deferred)