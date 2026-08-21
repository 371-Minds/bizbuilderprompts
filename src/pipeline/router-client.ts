/**
 * Sovereign LLM client for the 371 Router (:3000), with fallback to the local
 * fast model (:8081).
 *
 * Primary — 371 Router (:3000):
 *   - OpenAI-compatible, routes to DeepSeek/Z.AI
 *   - Cost attributed to `bizbuilder-mgr` via `sk-371router`
 *   - Enforces $50/mo per-agent cap + budget alerts
 *   - `task_type` + `quality` logged for attribution
 *
 * Fallback — Local Fast (:8081):
 *   - LFM2.5-1.2B-Instruct (Q4_0), 118 tok/s, always-on, $0
 *   - Used only when the router is unreachable or returns a hard error
 *   - MUCH weaker model — extractions will be lower quality. The fallback is a
 *     safety net, not a preferred path. When it fires, the returned content is
 *     annotated with `__fallback: true` so callers can warn downstream.
 *
 * No OpenAI. No Anthropic. No external LLM. Sovereignty preserved.
 */

import { createHash } from "crypto";

/** Router endpoint + auth. Defaults to local :3000 with the shared bizbuilder-mgr key. */
export interface RouterConfig {
  baseUrl: string;
  apiKey: string;
}

const DEFAULT_CONFIG: RouterConfig = {
  baseUrl: process.env.ROUTER_BASE_URL ?? "http://localhost:3000/v1",
  apiKey: process.env.ROUTER_API_KEY ?? "sk-371router",
};

/** Local fast model fallback. LFM2.5-1.2B at :8081. */
const FALLBACK_CONFIG: RouterConfig = {
  baseUrl: process.env.FALLBACK_BASE_URL ?? "http://localhost:8081/v1",
  apiKey: process.env.FALLBACK_API_KEY ?? "no-key", // local llama-server needs no auth
};

/** Chat message in OpenAI format. */
export interface RouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallRouterOptions {
  /** Override the default model (deepseek-v4-flash). Ignored on fallback (only one local model). */
  model?: string;
  /** Logged by the router for attribution, e.g. "methodology-extraction". */
  taskType?: string;
  /** Quality tier hint for the router's routing policy. */
  quality?: "low" | "medium" | "high";
  /** Request strict JSON output. */
  json?: boolean;
  /** Per-call timeout. Default 120s (JSON-mode extraction + reasoning models can be slow). */
  timeoutMs?: number;
  /**
   * Disable the :8081 fallback. Set true when only the full router is acceptable
   * (e.g. the pre-score call where quality matters more than availability).
   */
  noFallback?: boolean;
}

/** Default model on the router: cheap, fast, excellent for structured extraction. */
const DEFAULT_MODEL = "deepseek-v4-flash";

/** Marker injected into fallback responses so callers can detect degraded output. */
export const FALLBACK_MARKER = "__via_local_fallback__";

/**
 * Call the 371 Router's OpenAI-compatible chat endpoint, with automatic fallback
 * to the local fast model (:8081) on router failure.
 *
 * @returns the assistant message text (first choice). If served by the fallback,
 *          the text is prefixed with the FALLBACK_MARKER on its own line.
 * @throws only if BOTH primary and fallback fail.
 */
export async function callRouter(
  messages: RouterMessage[],
  opts: CallRouterOptions = {}
): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  // ── Try primary (router) ─────────────────────────────────────────────────
  try {
    return await callEndpoint(DEFAULT_CONFIG, model, messages, opts, timeoutMs);
  } catch (primaryErr) {
    if (opts.noFallback) throw primaryErr;

    // Only fall back on connectivity / availability errors, not on malformed-request
    // 4xx errors (those would fail identically on the fallback and waste a call).
    const isAvailabilityError = isUnavailable(primaryErr);
    if (!isAvailabilityError) throw primaryErr;

    // ── Fallback (local :8081) ─────────────────────────────────────────────
    try {
      const content = await callEndpoint(
        FALLBACK_CONFIG,
        "local-primary", // :8081 serves one model; the router's alias for it
        messages,
        opts,
        timeoutMs
      );
      // Annotate so callers + the provenance block can record that this was degraded.
      return `${FALLBACK_MARKER}\n${content}`;
    } catch (fallbackErr) {
      // Both failed — surface the primary error (more informative) with the fallback noted.
      throw new Error(
        `Primary router failed (${safeMsg(primaryErr)}) and local fallback also failed (${safeMsg(fallbackErr)}). Both :3000 and :8081 are unavailable.`
      );
    }
  }
}

/** Call a single OpenAI-compatible endpoint. Throws on any failure. */
async function callEndpoint(
  config: RouterConfig,
  model: string,
  messages: RouterMessage[],
  opts: CallRouterOptions,
  timeoutMs: number
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };
  if (opts.taskType) body.task_type = opts.taskType;
  if (opts.quality) body.quality = opts.quality;
  if (opts.json) body.response_format = { type: "json_object" };

  let resp: Response;
  try {
    resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg = safeMsg(err);
    if (msg.includes("TimeoutError") || msg.includes("timeout") || msg.includes("abort")) {
      throw new Error(`Endpoint timed out after ${timeoutMs}ms (${config.baseUrl}, model: ${model})`);
    }
    throw new Error(`Endpoint unreachable at ${config.baseUrl}: ${msg}`);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(
      `Endpoint ${config.baseUrl} returned HTTP ${resp.status} ${resp.statusText} (model: ${model}): ${detail.slice(0, 500)}`
    );
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Endpoint ${config.baseUrl} returned no content (malformed response)`);
  }
  return content;
}

/** True if the error indicates the endpoint is down/unreachable (vs. a bad request). */
function isUnavailable(err: unknown): boolean {
  const msg = safeMsg(err).toLowerCase();
  return (
    msg.includes("unreachable") ||
    msg.includes("econnrefused") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up") ||
    // 5xx = server problem, worth retrying on fallback
    /\bhttp 5\d\d\b/.test(msg)
  );
}

function safeMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * SHA-256 of a string, hex-encoded. Used for provenance — every extracted asset
 * carries the hash of its source so claims are verifiable against the original text.
 */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
