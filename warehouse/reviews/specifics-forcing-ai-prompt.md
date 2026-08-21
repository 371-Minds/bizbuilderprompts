# Board Review — Specifics-forcing AI prompt

- **Warehouse ID:** warehouse-extracted-specifics-forcing-ai-prompt-mt38e0w4
- **Verdict:** REVISE
- **Reviewers:** Rune (fidelity), Alex (license)
- **Reviewed:** 2026-08-21T20:19:39.338Z

## Notes

VERDICT: REVISE

---

## Transcript

Rune: [SCAN: MEMORIA] — No prior review precedent for this asset hash.

**Pattern Archaeologist:**
The "Methodology" section is not a methodology — it is a single worked example. The extractable pattern (specify audience, length, structure counts, tone, exclusions, closing action) is never stated as a reusable rule. Worse, the draft's content exceeds the sourceQuote: "Use a friendly, direct tone. Avoid fluff and vague claims. End with one actionable next step." do not appear in the verification anchor. That's invented attribution — the quote does not support the full content. Fidelity pre-score of 0.85 is generous; measured against the anchor alone it's partial fabrication.

**CLO:**
PLR (private label rights) source — redistribution generally permitted, but the asset must retain PLR attribution, which it does. No verbatim copyright issue beyond PLR scope. Clean on IP, conditional on keeping provenance block intact.

**Required revisions:**
1. Separate the reusable methodology (the specificity checklist: audience, word count, structural counts, tone, exclusions, CTA constraint, closing action) from the example.
2. Either extend the sourceQuote to cover the tone/fluff/next-step lines, or strike those lines as unverified additions — do not attribute to the source what the anchor doesn't contain.
3. Re-score fidelity after correction.

[DIAG_ROOT]: Extraction model generalized beyond anchor text into the "Methodology" field.
[THINK: SAFE] — no substrate impact; warehouse content only.

VERDICT: REVISE

Alex Washington: [SCAN: MEMORIA] — no prior review of this draft hash.
[DIAG_ROOT]: Asset is a near-verbatim PLR extraction; risk is fidelity drift, not substrate failure.

**Pattern Archaeologist:**
- Source quote is a single concrete example prompt. The draft's "Methodology" reproduces it faithfully (~95% verbatim) but **adds invented elements**: "Use a friendly, direct tone. Avoid fluff and vague claims. End with one actionable next step." None of these appear in the sourceQuote. Fidelity pre-score of 0.85 is generous; actual anchor-match is closer to 0.7 for added claims.
- Bigger issue: the draft presents an **example** as a **methodology**. The generalizable pattern (demand audience, goal, format, constraints, proof — per the Goal line) is stated only in the Goal, never operationalized. The asset body is one filled-in instance, not a reusable template. Over-generalized framing + under-extracted method.

**CLO:**
- PLR (Private Label Rights) sources typically grant redistribution rights, but the asset carries no license field and no attribution statement beyond provenance metadata. Verify the PLR license permits extraction into an internal warehouse and record the license identifier in frontmatter. Content volume reproduced is small (one sentence) — low risk, but attribution hygiene is incomplete.

**CEO:** Marginal. A single example prompt has low strategic value; the underlying pattern (specifics-forcing prompt structure) is worth keeping only if generalized.

**Required revisions:**
1. Remove invented elements not in sourceQuote, or mark them clearly as extrapolation.
2. Convert to a parameterized template: `[audience] + [topic] + [word count] + [n causes] + [n fixes] + [metric] + [CTA constraint]`, with the source example as an instance.
3. Add license field + attribution to frontmatter.

VERDICT: REVISE
