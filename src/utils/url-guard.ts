/**
 * SSRF guard for outbound URL fetches.
 *
 * BizBuilderPrompts runs stdio-only by default, but the HTTP transport and the
 * `enrich_input` tool both accept arbitrary URLs from callers. Before any
 * `fetch()`, run the URL through `assertPublicUrl` to block requests to private
 * / loopback / link-local addresses — the standard SSRF surface (AWS metadata
 * endpoint, internal services, the tailnet, localhost admin ports).
 *
 * Closes BLOCK-2 from the C-Suite review (SSRF in enrich_input). No new deps —
 * Node's `dns` and `net` are built-in.
 */

import { lookup } from "dns/promises";
import { isIP } from "net";

export class SsrfBlockedError extends Error {
  constructor(url: string, reason: string) {
    super(`URL blocked by SSRF guard (${reason}): ${url}`);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Validate a URL is safe to fetch. Throws SsrfBlockedError if the scheme is
 * disallowed or the host resolves to a private/loopback/link-local address.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(rawUrl, "malformed URL");
  }

  // Scheme allowlist — no file://, no gopher://, etc.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfBlockedError(rawUrl, `scheme '${parsed.protocol}' not allowed`);
  }

  const host = parsed.hostname;

  // Literal IP in the URL? Validate directly without DNS.
  const literalIp = isIP(host);
  if (literalIp) {
    if (isPrivateIp(host)) {
      throw new SsrfBlockedError(rawUrl, `host ${host} is a private/loopback address`);
    }
    return;
  }

  // Hostname — resolve and check every returned address. If ANY address is
  // private, block (handles DNS rebinding where one record is public, one isn't).
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfBlockedError(rawUrl, `DNS resolution failed for ${host}`);
  }
  if (addrs.length === 0) {
    throw new SsrfBlockedError(rawUrl, `no DNS records for ${host}`);
  }
  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      throw new SsrfBlockedError(rawUrl, `host ${host} resolves to private address ${address}`);
    }
  }
}

/**
 * True if the IP string is private, loopback, link-local, or otherwise internal.
 * Covers IPv4 and the common IPv6 cases.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv6 loopback + link-local + unique-local
  if (ip === "::1") return true;
  if (ip.startsWith("fe80:")) return true; // link-local
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // unique local fc00::/7
  if (ip.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — check the embedded v4 address.
    return isPrivateIp(ip.slice(7));
  }

  // IPv4 — split and range-check
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    // Not a recognizable v4 — be conservative and block.
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local incl. AWS metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT — also Tailscale range)
  return false;
}
