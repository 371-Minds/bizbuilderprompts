import type { CsuiteRole } from "../agents/types.js";

export type FactoryAssetType =
  | "prompt"
  | "workflow"
  | "image-spec"
  | "project-template"
  | "agent-config"
  | "asset-bundle";

export type WorkflowFramework = "dsf" | "rcrc" | "kaizen" | "alchemist" | "custom";

export interface AssetSpec {
  type: FactoryAssetType;
  topic: string;
  goal: string;
  audience?: string;
  context?: string;
  framework?: WorkflowFramework;
  style?: string;
  steps?: string[];
  roles?: CsuiteRole[];
}

export interface AssetDraft {
  spec: AssetSpec;
  content: string;
  suggestedFilename: string;
  suggestedCategory: string;
  variables: string[];
  estimatedQuality: "low" | "medium" | "high";
}

export interface CommissionRequest {
  requestedBy?: CsuiteRole;
  assetSpec: AssetSpec;
  priority?: "low" | "normal" | "high";
  save?: boolean;
}

export interface FactoryResult {
  draft: AssetDraft;
  saved: boolean;
  warehouseId?: string;
  filePath?: string;
  additionalFiles?: Array<{ path: string; content: string }>;
}
