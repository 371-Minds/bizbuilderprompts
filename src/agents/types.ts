export type CsuiteRole =
  | "ceo"
  | "cmo"
  | "cfo"
  | "cto"
  | "vp_sales"
  | "vp_product"
  | "legal_counsel"
  | "head_of_ops";

export interface AgentPersona {
  role: CsuiteRole;
  displayName: string;
  description: string;
  systemPrompt: string;
  preferredCategories: string[];
  defaultWorkflows: string[];
  toolPermissions: string[];
  orderingPatterns: string[];
}

export interface AgentRegistry {
  agents: AgentPersona[];
  lastLoaded: string;
}
