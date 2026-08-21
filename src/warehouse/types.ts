import type { CsuiteRole } from "../agents/types.js";
import type { CommerceConfig } from "../commerce/types.js";

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

  // ── Commerce / Customer-Facing Fields ──────────────────────────────────
  /** Unique product identifier (SKU). Auto-generated if not set. */
  productId?: string;
  /**
   * Manufacturer's Suggested Retail Price in USD cents.
   * Examples: 99 = $0.99, 2900 = $29.00, 0 = free.
   * Undefined = not for sale / internal use only.
   */
  msrp?: number;
  /**
   * Search keywords for customer-facing discovery.
   * Distinct from `tags` — keywords are broader SEO/search terms;
   * tags are internal categorization labels.
   */
  keywords?: string[];
  /**
   * Payment and commerce configuration.
   * Supports x402 (HTTP 402 micropayments), Creem (fiat checkout),
   * Polar (OSS monetization), and Mercury Bank (treasury).
   */
  commerce?: CommerceConfig;

  /**
   * Provenance for extracted assets. Set by the methodology-extraction pipeline
   * so any claim in the asset body can be verified against the original source
   * via `sourceHash` + the `sourceQuote` embedded in the asset content.
   * Absent on commissioned/manually-created assets.
   */
  provenance?: {
    sourceLabel: string;
    sourceHash: string;
    extractedAt: string;
    model: string;
  };

  /**
   * Review-gate metadata captured by the review_draft tool. Written after each
   * successful board review so the verdict and reviewer rationale are queryable
   * without opening the full transcript in warehouse/reviews/.
   */
  review?: {
    verdict: "APPROVE" | "REVISE" | "REJECT";
    /** ISO timestamp of the review. */
    reviewedAt: string;
    /** Reviewer agent IDs that sat on the board. */
    reviewers: string[];
    /** Board notes (parsed verdict rationale). */
    notes: string;
    /** Leading excerpt of the full transcript (full text lives in warehouse/reviews/). */
    transcriptExcerpt: string;
  };
}

export interface Bundle {
  id: string;
  title: string;
  description: string;
  theme: string;
  targetRoles: CsuiteRole[];
  itemIds: string[];
  createdAt: string;

  // ── Commerce / Customer-Facing Fields ──────────────────────────────────
  /** Unique product identifier for the bundle as a whole. */
  productId?: string;
  /** Bundle MSRP in USD cents (may differ from sum of individual item prices). */
  msrp?: number;
  /** Keywords for bundle discovery. */
  keywords?: string[];
  /** Commerce config for the bundle as a unit (e.g. one-click bundle purchase). */
  commerce?: CommerceConfig;
}

export interface WarehouseCatalog {
  items: WarehouseItem[];
  bundles: Bundle[];
  lastUpdated: string;
  totalCount: number;
}

