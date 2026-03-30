export type FileType =
  | "prompt"
  | "workflow"
  | "workflow-step"
  | "image-prompt"
  | "project";

export interface PromptEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  variables: string[];
  filePath: string;
  fileType: FileType;
  mimeType: string;
  workflowId?: string;
  stepNumber?: number;
}

export interface WorkflowStep {
  stepNumber: number;
  id: string;
  title: string;
  filePath: string;
}

export interface WorkflowEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  dirPath: string;
  masterPromptPath?: string;
  steps: WorkflowStep[];
}

export interface Manifest {
  prompts: PromptEntry[];
  workflows: WorkflowEntry[];
  categories: string[];
  totalCount: number;
  lastIndexed: string;
}
