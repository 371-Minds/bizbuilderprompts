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
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildManifest } from "../src/manifest.ts";
import { createServer } from "../src/server.ts";

const PORT = parseInt(process.env.PORT || "8003");
const HOST = process.env.HOST || "127.0.0.1";

console.log("◆ BizBuilderPrompts MCP Server — starting...");
const manifest = await buildManifest();
console.log(`  Loaded ${manifest.prompts.length} prompts, ${manifest.workflows.length} workflows`);

const server = Bun.serve({
  port: PORT,
  hostname: HOST,

  async fetch(req) {
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

    // Streamable HTTP MCP transport
    if (url.pathname === "/mcp") {
      const mcpServer = createServer(manifest);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await mcpServer.connect(transport);
      return transport.handleRequest(req);
    }

    // SSE transport (legacy fallback for clients that prefer SSE)
    if (url.pathname === "/sse") {
      const mcpServer = createServer(manifest);
      const transport = new SSEServerTransport("/messages", new Response(""));
      await mcpServer.connect(transport);
      // Return the SSE stream
      const headers = new Headers();
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache");
      headers.set("Connection", "keep-alive");
      // SSEServerTransport handles the actual streaming internally
      return new Response("SSE endpoint — connect via MCP client", { headers });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`◆ BizBuilderPrompts MCP Server — ready`);
console.log(`  :${PORT}  ${manifest.prompts.length} prompts | ${manifest.workflows.length} workflows`);
console.log(`  http://localhost:${PORT}/health`);
