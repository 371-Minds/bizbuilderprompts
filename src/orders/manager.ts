import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { Order, OrderFulfillment, OrderStatus } from "./types.js";
import type { CsuiteRole } from "../agents/types.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORDERS_DIR = join(REPO_ROOT, "warehouse", "orders");
const ORDERS_FILE = join(ORDERS_DIR, "orders.json");

function ensureOrdersDir(): void {
  if (!existsSync(ORDERS_DIR)) {
    mkdirSync(ORDERS_DIR, { recursive: true });
  }
}

function loadOrders(): Order[] {
  if (!existsSync(ORDERS_FILE)) return [];
  try {
    const raw = readFileSync(ORDERS_FILE, "utf-8");
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]): void {
  ensureOrdersDir();
  writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

function generateOrderId(): string {
  return `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Create a new order and persist it. Returns the created Order. */
export function createOrder(
  requestedBy: CsuiteRole,
  intent: string,
  assetTypes: string[],
  urgency?: Order["urgency"]
): Order {
  const orders = loadOrders();
  const now = new Date().toISOString();

  const order: Order = {
    id: generateOrderId(),
    requestedBy,
    intent,
    assetTypes,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    urgency: urgency ?? "normal",
  };

  orders.push(order);
  saveOrders(orders);
  return order;
}

/** Get a specific order by ID. */
export function getOrder(orderId: string): Order | undefined {
  return loadOrders().find((o) => o.id === orderId);
}

/** List all orders, optionally filtered by role. */
export function listOrders(role?: CsuiteRole): Order[] {
  const all = loadOrders();
  if (!role) return all;
  return all.filter((o) => o.requestedBy === role);
}

/** Update an order's status and persist. */
export function updateOrder(orderId: string, updates: Partial<Order>): boolean {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
  saveOrders(orders);
  return true;
}

/** Mark an order as fulfilled. */
export function markFulfilled(orderId: string): boolean {
  return updateOrder(orderId, { status: "fulfilled" });
}

/** Mark an order as partially fulfilled. */
export function markPartial(orderId: string): boolean {
  return updateOrder(orderId, { status: "partial" });
}
