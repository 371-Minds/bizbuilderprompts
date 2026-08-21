# Execution Plan — warehouse-review-rationale

## Goal

Productionize reviewer-rationale capture in the warehouse review gate: `review_draft` must persist review metadata on the warehouse item and save the full board transcript to `warehouse/reviews/<slug>.md`, replacing the manual `revise_transcripts.ts` workaround.

## Scope

- `src/warehouse/types.ts` — extend `WarehouseItem` with optional `review?: { verdict, reviewedAt, reviewers, notes, transcriptExcerpt }`.
- `src/tools.ts` (`review_draft` handler) — after a successful review: write review metadata via `updateWarehouseItem` and persist the full transcript to `warehouse/reviews/<slug>.md` following the `revise_transcripts.ts` file format.
- New unit test for the metadata write, following `src/__tests__/` patterns.

## Non-goals

- No changes to the review API client (`src/pipeline/review.ts`) or verdict parsing.
- No migration of past reviews; `revise_transcripts.ts` stays as-is.
- No new MCP tools or schema changes beyond the optional metadata field.

## Implementation Plan

### Phase 1: Types + review_draft capture

- 1.1 Add optional review metadata field to `WarehouseItem` in `src/warehouse/types.ts`.
- 1.2 Update `review_draft` handler in `src/tools.ts` to persist metadata + write transcript file to `warehouse/reviews/`.

### Phase 2: Test + gate

- 2.1 Add unit test covering the review metadata write (catalog round-trip).
- 2.2 Run `bun test` / validation gate; commit.

## Risks

- Transcript writes touch the filesystem inside the tool handler; failures must not break the verdict flow (wrap in try/catch, non-fatal).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Types + review_draft capture

- [x] 1.1 Add optional review metadata field to WarehouseItem — e1ad5fc
- [x] 1.2 Persist review metadata + transcript in review_draft handler — e1ad5fc

### Phase 2: Test + gate

- [x] 2.1 Add unit test for the metadata write — 38ce729
- [x] 2.2 Run validation gate (bun test) — 38ce729
