import type { CsuiteRole } from "../agents/types.js";

export type OrderStatus = "pending" | "partial" | "fulfilled" | "failed";

export interface Order {
  id: string;
  requestedBy: CsuiteRole;
  intent: string;
  assetTypes: string[];
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  urgency?: "low" | "normal" | "high";
}

export interface OrderItem {
  assetId: string;
  assetType: string;
  title: string;
  status: "found" | "commissioned" | "pending";
  filePath?: string;
}

export interface OrderFulfillment {
  orderId: string;
  status: OrderStatus;
  readyAssets: OrderItem[];
  pendingCommissions: OrderItem[];
  suggestions: string[];
}
