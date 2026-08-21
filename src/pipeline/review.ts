/**
 * C-Suite review gate for draft assets.
 *
 * Calls the mindsclip3 Board Meeting API (:7372) — the same API your live
 * agents use in Open WebUI — to get an in-character review of a draft. The
 * meeting prompt asks for a structured verdict; on APPROVE the caller promotes
 * the warehouse item to "ready".
 *
 * Sovereign: mindsclip3 routes reviewer responses through the 371 Router.
 * Reviewers = Rune (pattern fidelity) + Alex (legal/license) by default.
 */

import type { Provenance } from "./types.js";

const MEETING_URL = process.env.MINDSCLIP_URL ?? "http://localhost:7372";
const MEETING_TIMEOUT_MS = 90_000; // board meetings take longer than single calls

export type Verdict = "APPROVE" | "REJECT" | "REVISE";

export interface ReviewRequest {
  title: string;
  content: string;
  reviewers: string[];
  provenance?: Provenance;
}

export interface ReviewResult {
  verdict: Verdict;
  notes: string;
  transcript: string;
}

const REVIEW_SYSTEM_PROMPT = `You are reviewing a DRAFT asset before it is promoted to the warehouse as a ready, reusable asset that all agents can use.

Each reviewer should answer from their role:
- Pattern Archaeologist: Is this a faithful extraction of a genuine methodology? Does the sourceQuote actually support the content? Flag invented or over-generalized claims.
- CLO: Any license, IP, attribution, or compliance issues? Flag content that reproduces copyrighted material verbatim or lacks attribution where required.
- CEO (if present): Is this strategically worth adding to the warehouse?

End the meeting with a single line in EXACTLY this format (no other text after it):
VERDICT: APPROVE   |   VERDICT: REVISE   |   VERDICT: REJECT

- APPROVE = ready to activate. Faithful, clean, useful.
- REVISE  = promising but needs edits. Specify what.
- REJECT  = invented, unsafe, or not a methodology. Specify why.`;

/**
 * Submit a draft for C-Suite review via the Board Meeting API.
 * Returns the parsed verdict + the full transcript.
 */
export async function requestReview(req: ReviewRequest): Promise<ReviewResult> {
  const body = {
    topic: `Warehouse draft review: ${req.title}`,
    attendees: req.reviewers,
    roundtable: false,
    // The meeting API injects its own role hint but nothing about the verdict
    // protocol — the review rubric must travel with the context.
    context: `${REVIEW_SYSTEM_PROMPT}\n\n---\n\n${buildReviewContext(req)}`,
  };

  let resp: Response;
  try {
    resp = await fetch(`${MEETING_URL}/api/v1/csuite/meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MEETING_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("TimeoutError") || msg.includes("timeout") || msg.includes("abort")) {
      throw new Error(`Review meeting timed out after ${MEETING_TIMEOUT_MS}ms (mindsclip3 :7372)`);
    }
    throw new Error(`mindsclip3 unreachable at ${MEETING_URL}: ${msg}`);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(
      `Board Meeting API returned HTTP ${resp.status} ${resp.statusText}: ${detail.slice(0, 400)}`
    );
  }

  const data = (await resp.json()) as {
    transcript?: string;
    meeting?: Record<string, Array<{ agent?: string; name?: string; content?: string }>>;
    notes?: string;
  };

  // The API returns a phased meeting object ({opening: [...], ...phases}) —
  // flatten all phases into a transcript string. Older transcript field kept
  // as a fallback.
  const transcript =
    data.transcript && data.transcript.length > 0
      ? data.transcript
      : Object.values(data.meeting ?? {})
          .filter(Array.isArray)
          .flat()
          .map((t) => `${t.name ?? t.agent ?? "reviewer"}: ${t.content ?? ""}`)
          .join("\n\n");

  const verdict = parseVerdict(transcript);

  return {
    verdict,
    notes: data.notes && data.notes.length > 0 ? data.notes : extractNotes(transcript),
    transcript,
  };
}

function buildReviewContext(req: ReviewRequest): string {
  const lines = [
    `## Draft under review: ${req.title}`,
    "",
    req.provenance
      ? [
          "**Provenance (this is an extracted asset):**",
          `- Source: ${req.provenance.sourceLabel}`,
          `- Source hash: ${req.provenance.sourceHash}`,
          `- Extracted: ${req.provenance.extractedAt} via ${req.provenance.model}`,
          "",
          "Verify the asset's claims against the sourceQuote embedded in the content. The source is identified by the hash above.",
        ].join("\n")
      : "**Provenance:** commissioned asset (not extracted — no source to verify against).",
    "",
    "---",
    "",
    "**DRAFT CONTENT:**",
    "",
    req.content,
  ];
  return lines.join("\n");
}

/** Extract the last VERDICT line from the transcript. Defaults to REVISE on ambiguity. */
function parseVerdict(transcript: string): Verdict {
  const matches = transcript.match(/VERDICT:\s*(APPROVE|REVISE|REJECT)/gi);
  if (!matches || matches.length === 0) return "REVISE"; // conservative default
  const last = matches[matches.length - 1].toUpperCase();
  if (last.includes("APPROVE")) return "APPROVE";
  if (last.includes("REJECT")) return "REJECT";
  return "REVISE";
}

/** If the meeting didn't populate notes, grab the text after the final VERDICT line. */
function extractNotes(transcript: string): string {
  const idx = transcript.toUpperCase().lastIndexOf("VERDICT:");
  if (idx === -1) return transcript.slice(-500);
  return transcript.slice(idx).trim();
}
