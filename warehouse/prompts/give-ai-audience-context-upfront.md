# Give AI audience context upfront

> **Goal:** Make AI output match real intent by defining the reader, their goal, level, and situation before requesting content.
> **Framework:** custom
> **Tags:** ai-prompts, audience, context

---

## Methodology

Before every AI request, paste a context block with each slot filled for the actual task:

- Audience is **[X]**.
- They have **[constraint]**.
- They fear **[objection]**.
- Goal is **[Y]**.
- Tone is **[Z]**.
- Context is **[W]**.

Then ask for practical steps and language that fits that reader.

## Worked example (from the source)

> Audience is first time Etsy sellers. They have 2 hours a week. They fear tech. Goal is 10 listings. Tone is friendly and direct. Context is a 7 day challenge.

The example is illustrative — replace every slot with the current task's values; never paste it verbatim into unrelated work.

---

## Provenance

- **Source:** PLR: 50 Ways to Avoid Lazy AI Slop (SuperSalesMachine) — 371 transformation pass 1
- **Source hash:** `569abcd11b44999af47b8f9e6dfec5d7d3b5f74987f63321b06897b6d5ed378e`
- **Extracted:** 2026-08-21T17:34:35.972Z via deepseek-v4-flash
- **Fidelity pre-score:** 0.40 (methodology rewritten as parameterized template; Etsy case demoted to worked example in the 2026-08-22 revise pass)

### Source quote (verification anchor)

> Audience is first time Etsy sellers, they have 2 hours a week, they fear tech, goal is 10 listings, tone is friendly and direct, context is a 7 day challenge
