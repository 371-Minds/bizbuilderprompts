/**
 * Extracts all {{VariableName}} placeholders from a prompt string.
 * Handles spaces and underscores in variable names.
 */
export function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{(\w[\w\s]*?)\}\}/g);
  const seen = new Set<string>();
  const variables: string[] = [];
  for (const match of matches) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      variables.push(name);
    }
  }
  return variables;
}

/**
 * Fills {{VariableName}} placeholders in a prompt string with provided values.
 * Returns the filled string and a list of any variables that were not provided.
 */
export function fillTemplate(
  content: string,
  values: Record<string, string>
): { filled: string; unfilled: string[] } {
  const allVars = extractVariables(content);
  const unfilled: string[] = [];

  let filled = content;
  for (const varName of allVars) {
    const value = values[varName] ?? values[varName.replace(/\s+/g, "_")];
    if (value !== undefined) {
      filled = filled.replaceAll(`{{${varName}}}`, value);
    } else {
      unfilled.push(varName);
    }
  }
  return { filled, unfilled };
}
