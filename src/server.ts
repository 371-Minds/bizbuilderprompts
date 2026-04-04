import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Manifest } from "./types.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";
import { registerPrompts } from "./prompts.js";
import { buildSearchIndex } from "./utils/search.js";
import { buildWarehouseCatalog } from "./warehouse/catalog.js";
import { loadAgentRegistry } from "./agents/registry.js";

export function createServer(manifest: Manifest): McpServer {
  const server = new McpServer({
    name: "bizbuilderprompts",
    version: "2.0.0",
  });

  buildSearchIndex(manifest.prompts);

  // Initialize warehouse catalog and agent registry at startup
  const catalog = buildWarehouseCatalog(manifest);
  const registry = loadAgentRegistry();

  registerResources(server, manifest);
  registerTools(server, manifest, catalog, registry);
  registerPrompts(server, manifest, registry);

  return server;
}
