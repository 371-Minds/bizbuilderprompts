# Router Bug — `task_type` / `quality` not persisted for some callers

**Status:** Open. Blocking accurate cost attribution for the new methodology-extraction pipeline.
**Reported by:** BizBuilderPrompts pipeline (smoke run, 2026-07-16)
**Severity:** Low (cost still attributed to the right agent via API key; only the `task_type`/`quality` labels are lost)
**Where to fix:** `/opt/371storage/projects/371-router/`

---

## Summary

The 371 Router accepts `task_type` and `quality` in the request body and is *supposed* to log them in the `usage` table (per the June 12 build notes in `BUILD_STATUS_20260608.md`). The logging code is correct and 72% of historical rows (2,611 / 3,622) have non-null `task_type`. But calls from the new BizBuilderPrompts extraction pipeline — and a direct `curl` probe — log with **empty `task_type` and `quality`**, even though the same calls succeed and return correct responses.

## Reproduction (100% reliable)

```bash
# 1. Send a call with a unique task_type:
curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-371router" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "task_type": "doc-probe-7",
    "quality": "high",
    "messages": [{"role":"user","content":"hi"}],
    "stream": false,
    "max_tokens": 3
  }'

# 2. Query for it — it will NOT be there:
sqlite3 /opt/371storage/projects/371-router/data/router.db \
  "SELECT ts, agent, task_type, quality FROM usage WHERE task_type='doc-probe-7';"
# → (empty)

# 3. But the call itself succeeded and a row WAS written — just with null task_type:
sqlite3 -header /opt/371storage/projects/371-router/data/router.db \
  "SELECT substr(ts,1,19) ts, agent, model, task_type, quality FROM usage ORDER BY id DESC LIMIT 3;"
# Expected output (note empty task_type/quality):
#   ts                  | agent   | model              | task_type | quality
#   2026-07-15 01:38:12 | default | deepseek-v4-flash  |           |
#   2026-07-15 01:37:22 | default | deepseek-v4-flash  |           |
#   2026-07-15 01:36:18 | default | deepseek-v4-flash  |           |
```

## What's NOT the bug (already verified)

These are all correct — do not "fix" them:

| Check | Location | Status |
|-------|----------|--------|
| DB schema has the columns | `src/db.ts:31` (`task_type TEXT`) | ✅ Correct |
| `logUsage()` writes the columns | `src/db.ts:110-121` (`.run(..., row.task_type ?? null, row.quality ?? null)`) | ✅ Correct |
| Handler extracts from body | `src/index.ts:66` (`task_type: body.task_type`) and `src/index.ts:76` (`const taskType = body.task_type \|\| null`) | ✅ Correct |
| Every `logUsage()` call site passes it | `src/index.ts` lines 88-99, 184-195, 217-228, 237-248, 273-284, 297-308 | ✅ All 6 sites pass `task_type: taskType` |
| Running service uses current source | PID 2354414 = `bun run src/index.ts`, started 2026-07-15 21:30, source mtime 2026-06-12 | ✅ Not stale |
| `dist/` is older but unused | `dist/index.js` mtime 2026-06-08 (predates fix) — but service runs `src/`, not `dist/` | ✅ N/A |

**The plumbing is intact end to end.** The task_type value is being lost somewhere between `c.req.json()` parsing and the `logUsage` call, but only for *some* callers — not all.

## Hypotheses to investigate (in order of likelihood)

### H1 — Body consumed twice (most likely)
Hono's `c.req.json()` can only be called once per request; a second call returns `{}`. If anything reads the body before line 49 (`const body = await c.req.json()`) — a middleware, a cache-key builder, a guardrail check — the parsed `body` object will be empty and `body.task_type` will be `undefined`.

**Check:** grep for other `c.req.json()` / `req.json()` calls in the same file or in middleware wired before this route. The `cache.ts` layer (which builds cache keys) is a prime suspect — if it reads the body to hash it, the main handler gets an empty body.

```bash
grep -rn "req.json\|c.req.json\|request.json" /opt/371storage/projects/371-router/src/
```

### H2 — Cache hit short-circuits before task_type is read
The cache layer (`src/layers/cache.ts`) returns cached responses for repeated prompts. If a cache hit is detected *before* `body.task_type` is extracted (line 76), the cache-hit logUsage at `index.ts:184-195` would still get `taskType` from the outer scope — but if the cache layer returns early via a different code path, it may log without it.

**Check:** the extraction pipeline sends the same doc repeatedly during testing — those would be cache hits. Look at whether cached responses log task_type. (The repro above uses unique content, so it shouldn't be cached — but verify.)

### H3 — `response_format` / JSON-mode requests take a different path
The extraction pipeline sends `"response_format": {"type": "json_object"}` (the only caller that does). If the router has special handling for `response_format` that branches before metadata extraction, that branch may not pass `taskType`.

**Check:** grep for `response_format` in the router source.

```bash
grep -rn "response_format" /opt/371storage/projects/371-router/src/
```

### H4 — `meta` object vs. local `taskType` divergence
There are TWO extractions of task_type in the handler:
- Line 66: `task_type: body.task_type` (into the `meta` object)
- Line 76: `const taskType = body.task_type || null` (local variable used by logUsage)

If `body` was re-fetched or mutated between 66 and 76, they'd diverge. Unlikely but worth a glance.

## The working callers (for comparison)

These callers DO get task_type logged correctly — compare their request shape to the pipeline's:

- **Anton agents** (via mindsclip3 `router_371` adapter) — `task_type` lands in DB
- **mindsclip3 Company Wizard** — `task_type` lands in DB

Their requests come through a different client (the adapter), so diffing the two request shapes may reveal the trigger. The BizBuilderPrompts pipeline client is at `/home/ab/Projects/bizbuilderprompts/src/pipeline/router-client.ts` — it's a minimal `fetch()` POST with `task_type` in the JSON body, nothing unusual.

## Impact

- **Cost attribution:** Still works — calls are attributed to `default` / `sk-371router` (the bizbuilder-mgr key) and counted against the $50/mo cap.
- **Per-task analysis:** Broken — can't query `WHERE task_type='methodology-extraction'` to see extraction-specific spend.
- **Budget alerts:** Unaffected (keyed on agent, not task_type).

## Suggested fix approach

1. Add a one-line debug log at `src/index.ts:76` to print `body.task_type` immediately after parsing:
   ```ts
   console.log('[debug] task_type from body:', body.task_type, 'body keys:', Object.keys(body));
   ```
2. Send the repro curl above.
3. Check the router's stdout (`journalctl -u 371-router -f` or wherever PID 2354414 logs).
4. If `body.task_type` is `undefined` there, the body was already consumed upstream → H1. If it's correct there but null in DB, the loss is between 76 and the logUsage call.

---

*Diagnosed during the methodology-extraction pipeline smoke run. The pipeline itself is not blocked — it works end-to-end. This is purely a router telemetry gap.*
