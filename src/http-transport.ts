#!/usr/bin/env bun
/**
 * BizBuilderPrompts MCP Server — Streamable HTTP Transport
 * 
 * Runs the MCP server over HTTP so Pi agents and other services
 * can connect via network without spawning a child process.
 * 
 * Port: 8003
 * Endpoints:
 *   GET  /         → Discovery
 *   GET  /health   → Health + stats
 *   POST /mcp      → JSON-RPC 2.0 MCP (Streamable HTTP)
 *   GET  /sse      → SSE fallback for older clients
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildManifest } from "./manifest.js";
import { createServer } from "./server.js";
import { serveFetch } from "./utils/node-serve.js";

const PORT = parseInt(process.env.PORT || "8003");
const HOST = process.env.HOST || "127.0.0.1";

console.log("◆ BizBuilderPrompts MCP Server — starting...");
const manifest = await buildManifest();
console.log(`  Loaded ${manifest.prompts.length} prompts, ${manifest.workflows.length} workflows`);

// Sessioned SSE fallback transports, keyed by session id.
const sseTransports = new Map<string, SSEServerTransport>();

serveFetch(PORT, HOST, async (req, ctx) => {
  const url = new URL(req.url);

  // Discovery
  if (url.pathname === "/") {
    return Response.json({
      service: "bizbuilderprompts-mcp",
      version: "2.0.0",
      transport: ["streamable-http", "sse"],
      endpoints: {
        "POST /mcp": "Streamable HTTP MCP transport",
        "GET /sse": "SSE MCP transport (legacy fallback)",
        "GET /health": "Health and stats",
      },
      stats: {
        prompts: manifest.prompts.length,
        workflows: manifest.workflows.length,
        categories: [...new Set(manifest.prompts.map(p => p.category))],
      },
    });
  }

  // Health check
  if (url.pathname === "/health") {
    return Response.json({
      status: "ok",
      prompts: manifest.prompts.length,
      workflows: manifest.workflows.length,
    });
  }

  // Streamable HTTP MCP transport (web-standard fetch surface).
  if (url.pathname === "/mcp") {
    const mcpServer = createServer(manifest);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await mcpServer.connect(transport);
    return transport.handleRequest(req);
  }

  // SSE transport (legacy fallback) — SSEServerTransport owns the raw socket.
  if (url.pathname === "/sse") {
    const mcpServer = createServer(manifest);
    const transport = new SSEServerTransport("/messages", ctx.nodeRes);
    await mcpServer.connect(transport);
    sseTransports.set(transport.sessionId, transport);
    await transport.start();
    return null;
  }

  // SSE inbound message endpoint.
  if (url.pathname === "/messages" && req.method === "POST") {
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const transport = sseTransports.get(sessionId);
    if (!transport) {
      return Response.json({ error: "unknown SSE session" }, { status: 404 });
    }
    await transport.handlePostMessage(ctx.nodeReq, ctx.nodeRes);
    return null;
  }

  return new Response("Not Found", { status: 404 });
});

console.log(`◆ BizBuilderPrompts MCP Server — ready`);
console.log(`  :${PORT}  ${manifest.prompts.length} prompts | ${manifest.workflows.length} workflows`);
console.log(`  http://localhost:${PORT}/health`);
