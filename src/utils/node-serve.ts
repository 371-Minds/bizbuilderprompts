/**
 * Runtime-agnostic HTTP server adapter.
 *
 * `api-server.ts` and `http-transport.ts` write their handlers against the
 * WHATWG `Request`/`Response` types (same ones Bun uses natively). This module
 * bridges those handlers onto Node's `node:http` server so the same source
 * compiles under `tsc` with only `@types/node` (no `@types/bun` needed) and
 * still runs correctly under Bun, Node >= 18, and Deno-style runtimes.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface FetchContext {
  /** The underlying Node request — exposed for transports that need a raw socket (SSE). */
  nodeReq: IncomingMessage;
  /** The underlying Node response — exposed for transports that write directly. */
  nodeRes: ServerResponse;
}

export type FetchHandler = (
  req: Request,
  ctx: FetchContext,
) => Promise<Response | null> | Response | null;

/**
 * Start an HTTP server on `port`/`host` and route every request through a
 * web-standard `fetch`-style handler. Returns the Node server instance.
 *
 * If the handler returns `null`, it is assumed to have taken ownership of the
 * raw `ctx.nodeRes` (used by the legacy SSE transport) and the adapter does
 * nothing further for that request.
 */
export function serveFetch(
  port: number,
  host: string,
  handler: FetchHandler,
) {
  const server = createServer((nodeReq, nodeRes) => {
    void (async () => {
      try {
        const url = `http://${nodeReq.headers.host ?? `${host}:${port}`}${nodeReq.url ?? "/"}`;
        const headers = new Headers();
        for (const [key, value] of Object.entries(nodeReq.headers)) {
          if (value === undefined) continue;
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.append(key, value);
          }
        }

        const method = nodeReq.method ?? "GET";
        const hasBody = method !== "GET" && method !== "HEAD";
        const body = hasBody ? await readBody(nodeReq) : undefined;

        const request = new Request(url, {
          method,
          headers,
          body,
        });

        const response = await handler(request, { nodeReq, nodeRes });

        // Handler took over the raw response (e.g. SSE streaming).
        if (response === null) return;

        await writeResponse(nodeRes, response);
      } catch (err) {
        if (!nodeRes.headersSent) {
          nodeRes.writeHead(500, { "Content-Type": "application/json" });
          nodeRes.end(JSON.stringify({ error: "internal server error", detail: (err as Error).message }));
        } else {
          nodeRes.destroy();
        }
      }
    })();
  });

  server.listen(port, host);
  return server;
}

function readBody(req: IncomingMessage): Promise<BodyInit | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total > 10 * 1024 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve(undefined);
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  res.writeHead(response.status, headers);
  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}
