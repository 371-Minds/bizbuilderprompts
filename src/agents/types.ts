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
  /**
   * Role identifier. The 8 C-Suite roles (CsuiteRole) ship as .md files in
   * agents/; specialist personas (growth_hacker, grant_writer, housing_sme,
   * etc.) can be registered at runtime via register_agent / the register_agent
   * tool. Both load through the same registry.
   */
  role: string;
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
