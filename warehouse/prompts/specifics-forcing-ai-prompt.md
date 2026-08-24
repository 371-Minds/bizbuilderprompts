# Specifics-forcing AI prompt

> **Goal:** Prompt AI in a way that makes vague output impossible — numbers, named entities, and checkable facts required up front.
> **Framework:** custom
> **Tags:** ai-collaboration, prompting, specificity, quality-control

---

## Methodology

1. Open the prompt with a ban list: no generic examples, no unnamed companies, no unquantified comparisons, no "studies show" without a citation target. State that any sentence failing these rules will be rejected.
2. Supply the specifics you want reflected back: the actual product name, the actual metric baselines, the actual customer quotes. AI interpolates from what it's given — give it a concrete substrate and it stays concrete.
3. Demand a fill-or-flag format: for every claim the model can't ground, it must write "NEEDS-SOURCE: [claim]" instead of inventing support. This converts hallucination risk into an explicit research to-do list.
4. Require the output to carry its own verification hooks — each factual statement tagged with [data], [anecdote], or [assumption]. You can then audit by tag: assumptions get checked, data gets sourced, anecdotes get confirmed as yours.
5. Run a rejection loop: return any section containing a banned pattern with a one-line reason. Two rounds of enforced rejection typically trains the remainder of the output into compliance.
6. Keep the final human pass for the numbers — even compliant AI output needs its figures checked against sources before anything ships.

This is the prompt-side twin of editing for specificity: instead of cutting vagueness after the fact, you refuse it at the door.
