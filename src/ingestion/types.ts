export type IngestionType = "prompt" | "framework" | "workflow";

export type FrameworkType =
  | "dsf"
  | "rcrc"
  | "kaizen"
  | "alchemist"
  | "system-user"
  | "template"
  | "structured"
  | "unknown";

export interface IngestionInput {
  content: string;
  filename?: string;
  title?: string;
  type?: IngestionType;
}

export interface CategoryCandidate {
  category: string;
  score: number;
}

export interface ClassificationResult {
  category: string;
  subcategory?: string;
  confidence: number;
  candidates: CategoryCandidate[];
  tags: string[];
  detectedVariables: string[];
  frameworkType: FrameworkType;
  suggestedFilename: string;
  reasoning: string;
}

export type IngestionResult = ClassificationResult & {
  saved: boolean;
  path?: string;
};

export interface IngestOptions {
  save?: boolean;
  overwrite?: boolean;
}

export interface CategoryInfo {
  name: string;
  description: string;
  keywords: string[];
  dirPath: string;
}
