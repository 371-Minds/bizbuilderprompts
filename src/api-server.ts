#!/usr/bin/env bun
/**
 * BizBuilderPrompts — HTTP API Server
 * 
 * Provides the full prompt library as a REST API for dashboards and services.
 * Pi agents access it via stdio MCP (bun dist/index.js).
 * HTTP clients access it via this server on :8003.
 * 
 * Port: 8003
 */

import { buildManifest } from "../src/manifest.ts";
import { searchPrompts, suggestPrompts } from "../src/utils/search.ts";
import { fillTemplate } from "../src/utils/template.ts";
import { buildWarehouseCatalog, searchWarehouse, getWarehouseItemById, getWarehouseItemContent, listBundles, getBundle, updateWarehouseItem } from "../src/warehouse/catalog.ts";
import { loadAgentRegistry, getAgentPersona, registerAgent, listAgents } from "../src/agents/registry.ts";
import { classify } from "../src/ingestion/classifier.ts";
import { listIngestionCategories } from "../src/ingestion/categories.ts";
import { createOrder, getOrder, listOrders } from "../src/orders/manager.ts";
import { readFileSync } from "fs";


const PORT = parseInt(process.env.PORT || "8003");
const HOST = process.env.HOST || "127.0.0.1";

console.log("◆ BizBuilderPrompts — loading manifest...");
const manifest = await buildManifest();
const catalog = buildWarehouseCatalog(manifest);
const agentRegistry = loadAgentRegistry();
const agentList = listAgents();
console.log(`  ${manifest.prompts.length} prompts, ${manifest.workflows.length} workflows`);

function getPromptContent(entry: any): string {
  try { return readFileSync(entry.filePath, "utf-8"); } 
  catch { return entry.content || ""; }
}

function summarize(entry: any) {
  return {
    id: entry.id, title: entry.title, category: entry.category,
    type: entry.fileType, description: entry.description,
    tags: entry.tags, variables: entry.variables,
    workflowId: entry.workflowId, stepNumber: entry.stepNumber,
  };
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const corsHeaders = { "Access-Control-Allow-Origin": "*" };

    // ── Discovery ──
    if (url.pathname === "/") {
      return Response.json({
        service: "bizbuilderprompts-mcp",
        version: "2.0.0",
        stats: {
          prompts: manifest.prompts.length,
          workflows: manifest.workflows.length,
          categories: [...new Set(manifest.prompts.map(p => p.category))],
          warehouseItems: catalog.items.length,
          bundles: catalog.bundles.length,
          agents: agentList.length,
        },
        endpoints: {
          "GET  /health": "Health check",
          "GET  /prompts": "List prompts (?category=&q=)",
          "GET  /prompts/:id": "Get prompt content",
          "GET  /workflows": "List workflows",
          "GET  /workflows/:id": "Get workflow with steps",
          "POST /search": "Search prompts {query, limit}",
          "POST /suggest": "Suggest by goal {goal, limit}",
          "GET  /warehouse": "Browse warehouse (?role=&category=&status=&q=)",
          "GET  /warehouse/:id": "Get warehouse item",
          "GET  /agents": "List C-Suite agents",
          "GET  /agents/:role": "Get agent persona",
          "POST /order": "Create order {role, intent, urgency}",
        },
      }, { headers: corsHeaders });
    }

    // ── Health ──
    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        prompts: manifest.prompts.length,
        workflows: manifest.workflows.length,
        uptime: process.uptime(),
      }, { headers: corsHeaders });
    }

    // ── List Prompts ──
    if (url.pathname === "/prompts" && req.method === "GET") {
      const category = url.searchParams.get("category");
      const q = url.searchParams.get("q");
      let results = manifest.prompts;
      if (category) results = results.filter(p => p.category === category);
      if (q) {
        const searchResults = searchPrompts(q, results, 50);
        results = searchResults.map(r => r.item);
      }
      return Response.json({
        count: results.length,
        prompts: results.map(summarize),
      }, { headers: corsHeaders });
    }

    // ── Get Prompt ──
    const promptMatch = url.pathname.match(/^\/prompts\/(.+)$/);
    if (promptMatch && req.method === "GET") {
      const entry = manifest.prompts.find(p => p.id === promptMatch[1]);
      if (!entry) return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      return Response.json({
        metadata: summarize(entry),
        content: getPromptContent(entry),
      }, { headers: corsHeaders });
    }

    // ── List Workflows ──
    if (url.pathname === "/workflows" && req.method === "GET") {
      return Response.json({
        count: manifest.workflows.length,
        workflows: manifest.workflows.map(w => ({
          id: w.id, title: w.title, description: w.description,
          tags: w.tags, stepCount: w.steps.length,
        })),
      }, { headers: corsHeaders });
    }

    // ── Get Workflow ──
    const wfMatch = url.pathname.match(/^\/workflows\/(.+)$/);
    if (wfMatch && req.method === "GET") {
      const wf = manifest.workflows.find(w => w.id === wfMatch[1]);
      if (!wf) return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      const masterEntry = wf.masterPromptPath
        ? manifest.prompts.find(p => p.filePath === wf.masterPromptPath)
        : undefined;
      const steps = wf.steps.map(s => {
        const stepEntry = manifest.prompts.find(p => p.filePath === s.filePath);
        return {
          stepNumber: s.stepNumber, id: s.id, title: s.title,
          content: stepEntry ? getPromptContent(stepEntry) : "",
        };
      });
      return Response.json({
        id: wf.id, title: wf.title, description: wf.description,
        tags: wf.tags, stepCount: wf.steps.length,
        masterPrompt: masterEntry ? getPromptContent(masterEntry) : undefined,
        steps,
      }, { headers: corsHeaders });
    }

    // ── Search ──
    if (url.pathname === "/search" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const results = searchPrompts(body.query || "", manifest.prompts, body.limit || 10);
      return Response.json({
        query: body.query,
        count: results.length,
        results: results.map(r => ({ ...summarize(r.item), relevanceScore: r.score, excerpt: r.excerpt })),
      }, { headers: corsHeaders });
    }

    // ── Suggest ──
    if (url.pathname === "/suggest" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const suggestions = suggestPrompts(body.goal || "", manifest.prompts, body.limit || 5);
      return Response.json({
        goal: body.goal,
        suggestions: suggestions.map(s => ({ ...summarize(s), reason: s.reason })),
      }, { headers: corsHeaders });
    }

    // ── Warehouse ──
    if (url.pathname === "/warehouse" && req.method === "GET") {
      const items = searchWarehouse(
        url.searchParams.get("q") || undefined,
        url.searchParams.get("role") as any || undefined,
        url.searchParams.get("category") || undefined,
        url.searchParams.get("status") as any || undefined,
      );
      return Response.json({
        count: items.length,
        items: items.map(i => ({
          id: i.id, type: i.type, title: i.title, description: i.description,
          targetRoles: i.targetRoles, status: i.status, tags: i.tags,
          productId: i.productId, msrp: i.msrp,
        })),
        bundles: catalog.bundles.map(b => ({
          id: b.id, title: b.title, itemCount: b.itemIds.length, targetRoles: b.targetRoles,
        })),
      }, { headers: corsHeaders });
    }

    // ── Get Warehouse Item ──
    const whMatch = url.pathname.match(/^\/warehouse\/(.+)$/);
    if (whMatch && req.method === "GET") {
      const item = getWarehouseItemById(whMatch[1]);
      if (!item) return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      return Response.json({
        metadata: item,
        content: getWarehouseItemContent(item),
      }, { headers: corsHeaders });
    }

    // ── Agents ──
    if (url.pathname === "/agents" && req.method === "GET") {
      return Response.json({
        count: agentList.length,
        agents: agentList.map(a => ({
          role: a.role, displayName: a.displayName, description: a.description,
          preferredCategories: a.preferredCategories, defaultWorkflows: a.defaultWorkflows,
        })),
      }, { headers: corsHeaders });
    }

    const agentMatch = url.pathname.match(/^\/agents\/(.+)$/);
    if (agentMatch && req.method === "GET") {
      const persona = getAgentPersona(agentMatch[1] as any);
      if (!persona) return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      return Response.json(persona, { headers: corsHeaders });
    }

    // ── Order ──
    if (url.pathname === "/order" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const fulfillment = await createOrder(body.role, body.intent, manifest, body.urgency);
      return Response.json(fulfillment, { headers: corsHeaders });
    }

    return Response.json({ error: "Not Found" }, { status: 404, headers: corsHeaders });
  },
});

console.log(`◆ BizBuilderPrompts API Server — ready`);
console.log(`  :${PORT}  ${manifest.prompts.length} prompts | ${manifest.workflows.length} workflows | ${catalog.items.length} warehouse items`);
console.log(`  http://localhost:${PORT}/health`);
