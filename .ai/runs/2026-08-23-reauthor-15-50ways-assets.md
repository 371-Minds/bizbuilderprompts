# Execution Plan — reauthor-15-50ways-assets

## Goal

Replace the 15 "50 Ways"-derived warehouse assets with wholly original 371 content (license resolution): fresh authorship from topic + core idea only, provenance blocks removed, re-reviewed through the C-Suite gate (Alex = originality diff vs source PDF, Rune = usefulness), then one PR.

## Scope

- The 15 warehouse items whose `provenance.sourceLabel` contains "50 Ways" (same IDs, same titles, same filePaths).
- Their content files under `warehouse/workflows/` — rewritten in place.
- `warehouse/index.json` — provenance key removed, status set to `draft`, fresh descriptions/tags; commerce/pricing untouched.
- New review transcripts under `warehouse/reviews/`.
- A one-shot gate script (pattern: `revise_transcripts.ts`) that calls `src/pipeline/review.ts` `requestReview` with reviewers `['rune-pattern','alex-clo']` and Alex's originality focus injected into the review context; persists transcripts natively (review_draft pattern).

## Non-goals

- Do NOT read the source PDF (`50WaysToAvoidLazyAISlopAndCreateContentPeopleWant.pdf`) — Alex reviews against it; we author from topic + core idea only.
- Do NOT reuse phrasing, structure, examples, or step-wording from the current derivative asset bodies (needed only IDs + titles).
- No commerce/pricing changes; no other warehouse items; no storefront wiring.

## Authorship rules

- Each asset: 4–7 step workflow or single-use prompt, tags, no placeholders.
- 371-OS voice: original steps, original examples, concrete operator guidance; 371 nomenclature where natural (cognitive loop, provenance, substrate).
- Provenance block removed from file bodies AND index entries (commissioned/original pattern — no `provenance` key).

## Implementation Plan

### Phase 1: Setup

- [ ] 1.1 Commit this plan; push branch; open bare draft PR

### Phase 2: Re-author assets

- [x] 2.1 Write 15 fresh content files (warehouse/workflows/, in place) — 30c3179
- [x] 2.2 Update index.json: remove provenance, status draft, fresh descriptions/tags; verify commerce untouched — 30c3179

### Phase 3: C-Suite review gate

- [x] 3.1 Write gate script (revise_transcripts pattern + Alex originality focus, transcript persistence) — 3a9bab7
- [x] 3.2 Run gate; APPROVE → ready; REVISE → fix once, re-run, else leave draft with transcript — 3a9bab7

### Phase 4: Validation & PR

- [x] 4.1 Run `bunx vitest run` gate; fix failures
- [x] 4.2 Final commits, PR body, ready flip, summary comment

## Risks

- Live mindsclip3 dependency for reviews (:7372 verified up).
- Tests asserting provenance on these items may need updating (in-scope fix).
- Reviewer REVISE after one retry → item stays draft; disclosed in PR.

Engine: om-auto-create-pr (steps: 8, --loop: no)

## Progress

PR: #9 (link: https://github.com/371-Minds/bizbuilderprompts/pull/9)

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

- [x] 1.1 Commit this plan; push branch; open bare draft PR
- [x] 2.1 Write 15 fresh content files (warehouse/workflows/, in place) — 30c3179
- [x] 2.2 Update index.json: remove provenance, status draft, fresh descriptions/tags; verify commerce untouched — 30c3179
- [x] 3.1 Write gate script (revise_transcripts pattern + Alex originality focus, transcript persistence) — 3a9bab7
- [x] 3.2 Run gate; APPROVE → ready; REVISE → fix once, re-run, else leave draft with transcript — 3a9bab7
- [x] 4.1 Run `bunx vitest run` gate; fix failures
- [x] 4.2 Final commits, PR body, ready flip, summary comment
