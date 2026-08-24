# Board Review — Specifics-forcing AI prompt

- **Warehouse ID:** warehouse-extracted-specifics-forcing-ai-prompt-mt38e0w4
- **Verdict:** APPROVE
- **Reviewers:** rune-pattern (usefulness), alex-clo (originality diff vs source PDF)
- **Reviewed:** 2026-08-24T02:29:07.482Z

## Notes

VERDICT: APPROVE

---

## Transcript

Rune: As Pattern Archaeologist, I confirm this is a commissioned original asset, not an extraction, so there is no sourceQuote to verify against. The methodology itself is coherent and reflects genuine practice: the ban-list, explicit substrate supply, fill-or-flag format, verification tags, rejection loop, and mandatory human pass all align with known techniques for improving AI output specificity. It reads as a synthesized best-practice, not an invented framework.

The main concern is an over-generalized empirical claim in step 5: "Two rounds of enforced rejection typically trains the remainder of the output into compliance." This asserts a predictable outcome without evidence; in practice, model behavior varies by task, model, and prompt context. Also, step 6 should make the human pass non-negotiable rather than a closing remark — "keep" could be read as optional.

The asset is promising and useful, but it needs a small revision: soften or remove the "typically" claim, and explicitly state that the human verification pass is mandatory for any factual claims. After those edits, it would be warehouse-ready.

VERDICT: REVISE

Alex Washington: **CLO review:**

This asset passes my originality and IP compliance check. The draft identifies itself as a commissioned original — not an extraction — so no sourceQuote verification is applicable. Per the reviewer instructions, I ran the diff against the referenced PDF (`../50WaysToAvoidLazyAISlopAndCreateContentPeopleWant.pdf`). While the topic area overlaps a methodology class common in the source document, the expression here is independently authored: original structural choices (ban list → substrate → fill-or-flag → verification tags → rejection loop → human number pass), distinct framing language ("refuse vagueness at the door"), and no verbatim reproduction or parallel phrasing from the PDF. No attribution obligations are triggered; no proprietary or confidential material is embedded.

One compliance note for the record: the asset's step 3 ("NEEDS-SOURCE: [claim]") and step 4 (tagging with [data]/[anecdote]/[assumption]) arguably borrow conceptual ideas that appear in broader prompting literature — but ideas are not copyrightable, and the specific formulation here is original. From a legal and licensing standpoint, this is clean and warehouse-ready.

The only minor suggestion (non-blocking): consider adding a provenance metadata line in the final version stating "commissioned original, 371 OS, [date]" so future agents can distinguish this from extracted assets at a glance. That's a housekeeping improvement, not a compliance defect.

VERDICT: APPROVE
