# SDLC — bizbuilderprompts

This repo's pipeline is driven by the om-* agent skills, configured in `.ai/agentic.config.json` (tracker: `github` via `gh -R 371-Minds/bizbuilderprompts`).

## Ticket flow

1. Work starts as a GitHub issue (or a free-form brief handed to `om-auto-create-pr`).
2. `om-auto-create-pr` runs the work end-to-end on a fresh `feat/` or `fix/` branch in an isolated worktree, tracking progress in an execution plan under `.ai/runs/`.
3. The PR opens as a draft immediately after the plan commit, and flips to ready only when all Progress steps are complete.
4. `om-auto-review-pr` performs the single authoritative review pass; `om-auto-qa-pr` verifies user-facing UI changes when a browser provider is available.
5. `om-approve-merge-pr` squash-merges once review approves and the QA gate is satisfied.

## Label state machine

- Pipeline (mutually exclusive): `review` → `changes-requested` / `qa` → `merge-queue`, with `blocked` and `do-not-merge` as hold states.
- Category (additive): `bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`.
- Meta (additive): `needs-qa` vs `skip-qa` (never both), `qa-approved`, `qa-self-verified`, `in-progress` (claim lock), `ci-monitoring`.
- Exactly one priority (`priority-*`) and one risk (`risk-*`) label per PR.

## Validation gate

Run in order, all must pass:

1. `bun run typecheck`
2. `bunx vitest run`
3. `bun run build`

## QA gate

`qaGate` is on: a PR carrying `needs-qa` cannot merge until it also carries `qa-approved`. Server/API changes that can be exercised with curl may be self-verified (`qa-self-verified`) with evidence posted on the PR.

## Claim protocol

Automated skills claim work by assigning themselves and applying `in-progress` before touching a PR/issue, and release the lock when done. Never act on an item carrying someone else's `in-progress` label.
