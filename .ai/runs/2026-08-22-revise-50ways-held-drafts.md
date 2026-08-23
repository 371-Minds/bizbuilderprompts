# Execution Plan — revise-50ways-held-drafts

## Goal

Revise the 9 held "50 Ways to Avoid Lazy AI Slop" warehouse drafts per their board-review feedback (trim or mark unsupported steps as `[extension]`, tighten methodology to the sourceQuote anchor), re-run the board review via `requestReview` (rune-pattern + alex-clo), honor verdicts (APPROVE → `status: ready`), price newly-approved items per `price_ready.ts` conventions, and ship one PR summarizing per-item outcomes.

## Scope

- 9 draft assets: `start-with-one-reader-problem`, `one-sentence-audience-definition`, `promise-driven-opening`, `guardrail-outline-before-drafting`, `ruthless-fluff-cut`, `specifics-forcing-ai-prompt`, `give-ai-audience-context-upfront`, `headline-and-subhead-generation`, `real-reader-confusion-test` (ids `…-mt38e0w2..w5`).
- `warehouse/index.json` (status + commerce updates via `updateWarehouseItem`).
- `warehouse/reviews/*.md` (new board transcripts persisted by the review tooling).
- New one-shot scripts at repo root mirroring `revise_transcripts.ts` / `price_ready.ts` call patterns.

## Non-goals

- The 6 already approved/priced items and the non-PLR drafts (mrmz1d9*, mt38f49*) stay untouched.
- No changes to `src/` pipeline/tool code beyond what the scripts import.
- No Open Mercato feed work.

## Implementation Plan

### Phase 1: Setup

- [ ] 1.1 Worktree + branch `feat/revise-50ways-held-drafts` off `origin/main`; draft PR opened with this plan.

### Phase 2: Revise the 9 drafts

- [ ] 2.1 Edit each of the 9 asset files: trim/mark unsupported steps `[extension]`, generalize example-baked methodology (give-ai-audience-context-upfront, specifics-forcing-ai-prompt), fix run-together step formatting (real-reader-confusion-test). One commit.

### Phase 3: Re-review loop

- [ ] 3.1 Write `revisit_50ways.ts` (mirror of `revise_transcripts.ts`: requestReview with reviewers `rune-pattern`, `alex-clo`; persist transcripts to `warehouse/reviews/`; APPROVE → `updateWarehouseItem(id,{status:'ready'})`, REVISE → leave draft). Run it via bun; record tally.

### Phase 4: Pricing

- [ ] 4.1 Write/run `price_newly_ready.ts` mirroring `price_ready.ts` (300 cents, x402 USDC/base, payTo bootstrap seed wallet, per-topic keywords) scoped to items promoted in Phase 3.

### Phase 5: Gate + PR

- [ ] 5.1 Validation gate (`bunx vitest run`, `bunx tsc --noEmit || true`), summary comment with per-item outcomes, PR ready flip, worktree cleanup.

## Risks

- Board review depends on the local router (mindsclip3, :7372) — verified up before the run; if it drops mid-run, leave PR `in-progress` and resume later.
- Reviewer verdicts are non-deterministic; some items may stay `draft` — that is an honored outcome, not a failure.

## Progress

PR: #8

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Setup

- [x] 1.1 Worktree + branch + draft PR — 816cac9^

### Phase 2: Revise the 9 drafts

- [x] 2.1 Revise 9 asset files — 816cac9

### Phase 3: Re-review loop

- [x] 3.1 Re-review script + run — 49a43ad

### Phase 4: Pricing

- [x] 4.1 Price newly-approved items — 49a43ad

### Phase 5: Gate + PR

- [x] 5.1 Gate, summary, ready flip, cleanup
