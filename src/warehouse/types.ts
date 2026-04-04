import type { CsuiteRole } from "../agents/types.js";

export type WarehouseItemType =
  | "prompt"
  | "workflow"
  | "image-spec"
  | "project-template"
  | "agent-config"
  | "bundle";

export type WarehouseItemStatus = "draft" | "ready" | "featured";

export interface WarehouseItem {
  id: string;
  type: WarehouseItemType;
  title: string;
  description: string;
  targetRoles: CsuiteRole[];
  useCase: string;
  status: WarehouseItemStatus;
  commissionedBy?: CsuiteRole;
  commissionedAt?: string;
  linkedItems: string[];
  tags: string[];
  variables: string[];
  filePath: string;
  category?: string;
}

export interface Bundle {
  id: string;
  title: string;
  description: string;
  theme: string;
  targetRoles: CsuiteRole[];
  itemIds: string[];
  createdAt: string;
}

export interface WarehouseCatalog {
  items: WarehouseItem[];
  bundles: Bundle[];
  lastUpdated: string;
  totalCount: number;
}
