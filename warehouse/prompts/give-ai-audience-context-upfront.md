# Give AI audience context upfront

> **Goal:** Lead every AI brief with the audience definition and reading situation, so the first draft lands near the reader instead of the average.
> **Framework:** custom
> **Tags:** ai-collaboration, prompting, audience, briefing

---

## Methodology

1. Before the task, write the context block: who reads this (role, situation, what they already believe), where they read it (email, docs, social feed), and what they'll do next. This block goes at the top of the prompt — never appended after the ask.
2. Include the reader's objections and priors, not just demographics. "They've been burned by two CRM migrations already and distrust vendor claims" shapes every sentence that follows.
3. Set the register explicitly: sentence-length norms, jargon policy, and one exemplar passage written in the target voice. A short example outperforms a paragraph of adjectives about tone.
4. State what would make this reader stop reading — the failure modes. "They bounce on corporate we-statements" is an actionable constraint; "keep it engaging" is not.
5. Keep the task statement small and last: with a rich context block up front, the actual ask can be one line.
6. Iterate on the context, not the output. When the draft misses, amend the audience block and rerun — you're tuning the substrate the model writes from, which compounds across every future draft for that audience.

The habit generalizes: an audience block you write once becomes a reusable asset pasted into every subsequent brief for that segment.
