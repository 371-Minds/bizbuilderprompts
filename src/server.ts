import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Manifest } from "./types.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";
import { registerPrompts } from "./prompts.js";
import { buildSearchIndex } from "./utils/search.js";

export function createServer(manifest: Manifest): McpServer {
  const server = new McpServer({
    name: "bizbuilderprompts",
    version: "1.0.0",
  });

  buildSearchIndex(manifest.prompts);

  registerResources(server, manifest);
  registerTools(server, manifest);
  registerPrompts(server, manifest);

  return server;
}
