import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import type {
  WarehouseCatalog,
  WarehouseItem,
  Bundle,
  WarehouseItemStatus,
  WarehouseItemType,
} from "./types.js";
import type { CsuiteRole } from "../agents/types.js";
import type { Manifest } from "../types.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WAREHOUSE_DIR = join(REPO_ROOT, "warehouse");
const CATALOG_PATH = join(WAREHOUSE_DIR, "index.json");

// Role-to-category affinity map for search enrichment
const ROLE_CATEGORY_AFFINITY: Record<string, string[]> = {
  ceo: ["marketing", "sales", "project", "workflow"],
  cmo: ["marketing", "promotion", "video", "image-prompt"],
  cfo: ["workflow", "project", "general"],
  cto: ["workflow", "project", "general"],
  vp_sales: ["sales", "marketing", "promotion"],
  vp_product: ["project", "marketing", "workflow"],
  legal_counsel: ["workflow", "general"],
  head_of_ops: ["workflow", "project", "general"],
};

function loadCatalog(): WarehouseCatalog {
  if (!existsSync(CATALOG_PATH)) {
    return { items: [], bundles: [], lastUpdated: new Date().toISOString(), totalCount: 0 };
  }
  try {
    const raw = readFileSync(CATALOG_PATH, "utf-8");
    return JSON.parse(raw) as WarehouseCatalog;
  } catch {
    return { items: [], bundles: [], lastUpdated: new Date().toISOString(), totalCount: 0 };
  }
}

function saveCatalog(catalog: WarehouseCatalog): void {
  if (!existsSync(WAREHOUSE_DIR)) {
    mkdirSync(WAREHOUSE_DIR, { recursive: true });
  }
  catalog.lastUpdated = new Date().toISOString();
  catalog.totalCount = catalog.items.length;
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
}

/** Scan warehouse subdirectories for any items not yet in index.json */
function scanWarehouseDir(catalog: WarehouseCatalog): WarehouseItem[] {
  const existing = new Set(catalog.items.map((i) => i.filePath));
  const discovered: WarehouseItem[] = [];

  const subdirs: Array<{ dir: string; type: WarehouseItemType }> = [
    { dir: join(WAREHOUSE_DIR, "prompts"), type: "prompt" },
    { dir: join(WAREHOUSE_DIR, "image-specs"), type: "image-spec" },
    { dir: join(WAREHOUSE_DIR, "agent-configs"), type: "agent-config" },
  ];

  for (const { dir, type } of subdirs) {
    if (!existsSync(dir)) continue;
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.startsWith(".")) continue;
      const filePath = join(dir, f);
      if (existing.has(filePath)) continue;
      const ext = extname(f).toLowerCase();
      if (![".md", ".txt", ".json"].includes(ext)) continue;

      let content = "";
      try {
        content = readFileSync(filePath, "utf-8");
      } catch {
        // skip unreadable
      }
      const title = f.replace(/[_-]+/g, " ").replace(/\.\w+$/, "").trim();
      discovered.push({
        id: `warehouse-${type}-${title.toLowerCase().replace(/\s+/g, "-")}`,
        type,
        title,
        description: content.slice(0, 150).replace(/\n/g, " ").trim() || `${title} asset`,
        targetRoles: [],
        useCase: "",
        status: "draft",
        linkedItems: [],
        tags: [],
        variables: [],
        filePath,
        category: type === "prompt" ? "general" : type,
      });
    }
  }

  return discovered;
}

let _catalog: WarehouseCatalog | null = null;

/**
 * Build the warehouse catalog by merging:
 * 1. Persisted index.json
 * 2. Newly discovered files in warehouse/ subdirs
 * 3. Manifest items promoted to warehouse (if any)
 */
export function buildWarehouseCatalog(manifest?: Manifest): WarehouseCatalog {
  const catalog = loadCatalog();

  // Discover any new files added directly to warehouse dirs
  const newItems = scanWarehouseDir(catalog);
  if (newItems.length > 0) {
    catalog.items.push(...newItems);
    saveCatalog(catalog);
  }

  _catalog = catalog;
  return catalog;
}

/** Get the cached catalog (or build it if not loaded). */
export function getWarehouseCatalog(): WarehouseCatalog {
  return _catalog ?? buildWarehouseCatalog();
}

/** Add a new item to the warehouse catalog and persist it. */
export function addToWarehouse(item: WarehouseItem): void {
  const catalog = getWarehouseCatalog();

  // Replace existing item with same id or filePath
  const existingIdx = catalog.items.findIndex(
    (i) => i.id === item.id || i.filePath === item.filePath
  );
  if (existingIdx >= 0) {
    catalog.items[existingIdx] = item;
  } else {
    catalog.items.push(item);
  }

  saveCatalog(catalog);
  _catalog = catalog;
}

/** Update item status in warehouse. */
export function updateWarehouseItem(
  id: string,
  updates: Partial<WarehouseItem>
): boolean {
  const catalog = getWarehouseCatalog();
  const idx = catalog.items.findIndex((i) => i.id === id);
  if (idx < 0) return false;
  catalog.items[idx] = { ...catalog.items[idx], ...updates };
  saveCatalog(catalog);
  _catalog = catalog;
  return true;
}

/** Search warehouse items. Optionally filter by role, category, status, and text query. */
export function searchWarehouse(
  query?: string,
  role?: CsuiteRole,
  category?: string,
  status?: WarehouseItemStatus
): WarehouseItem[] {
  const catalog = getWarehouseCatalog();
  let results = [...catalog.items];

  if (role) {
    const affinity = ROLE_CATEGORY_AFFINITY[role] ?? [];
    results = results.filter(
      (item) =>
        item.targetRoles.includes(role) ||
        (item.targetRoles.length === 0 && affinity.includes(item.category ?? ""))
    );
  }

  if (category) {
    results = results.filter((item) => item.category === category || item.type === category);
  }

  if (status) {
    results = results.filter((item) => item.status === status);
  }

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.useCase.toLowerCase().includes(q)
    );
  }

  return results;
}

/** Get a specific warehouse item by id. */
export function getWarehouseItemById(id: string): WarehouseItem | undefined {
  return getWarehouseCatalog().items.find((i) => i.id === id);
}

/** Add a bundle to the warehouse. */
export function addBundle(bundle: Bundle): void {
  const catalog = getWarehouseCatalog();
  const existingIdx = catalog.bundles.findIndex((b) => b.id === bundle.id);
  if (existingIdx >= 0) {
    catalog.bundles[existingIdx] = bundle;
  } else {
    catalog.bundles.push(bundle);
  }
  saveCatalog(catalog);
  _catalog = catalog;
}

/** Get a bundle by id. */
export function getBundle(id: string): Bundle | undefined {
  return getWarehouseCatalog().bundles.find((b) => b.id === id);
}

/** Get all bundles. */
export function listBundles(): Bundle[] {
  return getWarehouseCatalog().bundles;
}

/** Get the full content of a warehouse item. */
export function getWarehouseItemContent(item: WarehouseItem): string {
  if (!existsSync(item.filePath)) return "";
  try {
    return readFileSync(item.filePath, "utf-8");
  } catch {
    return "";
  }
}

/** Ensure warehouse subdirectory exists and return its path. */
export function getWarehouseSubdir(type: WarehouseItemType): string {
  const typeToDir: Record<WarehouseItemType, string> = {
    prompt: "prompts",
    workflow: "workflows",
    "image-spec": "image-specs",
    "project-template": "prompts",
    "agent-config": "agent-configs",
    bundle: "bundles",
  };
  const subdir = join(WAREHOUSE_DIR, typeToDir[type] ?? "prompts");
  if (!existsSync(subdir)) {
    mkdirSync(subdir, { recursive: true });
  }
  return subdir;
}

export { WAREHOUSE_DIR };
