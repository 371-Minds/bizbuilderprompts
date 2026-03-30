#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildManifest } from "./manifest.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const manifest = await buildManifest();
  const server = createServer(manifest);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
