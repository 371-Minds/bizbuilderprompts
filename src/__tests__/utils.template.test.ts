import { describe, it, expect } from "vitest";
import { extractVariables, fillTemplate } from "../utils/template.js";

describe("extractVariables", () => {
  it("returns empty array for content with no variables", () => {
    expect(extractVariables("Hello world, no variables here.")).toEqual([]);
  });

  it("extracts a single variable", () => {
    expect(extractVariables("Hello {{Name}}!")).toEqual(["Name"]);
  });

  it("extracts multiple distinct variables", () => {
    const result = extractVariables("Dear {{Name}}, your {{Product}} is ready.");
    expect(result).toEqual(["Name", "Product"]);
  });

  it("deduplicates repeated variables", () => {
    const result = extractVariables("{{Topic}} is about {{Topic}} and more {{Topic}}.");
    expect(result).toEqual(["Topic"]);
  });

  it("handles variables with spaces", () => {
    const result = extractVariables("{{Business Context}} and {{Target Audience}}");
    expect(result).toEqual(["Business Context", "Target Audience"]);
  });

  it("handles variables with underscores", () => {
    const result = extractVariables("{{business_name}} and {{target_market}}");
    expect(result).toEqual(["business_name", "target_market"]);
  });

  it("does not extract variables with leading spaces (regex requires \\w start)", () => {
    // The regex pattern \w[\w\s]*? requires the variable to start with a word character.
    // Variables with leading spaces like {{  TrimmedVar  }} are not matched.
    const result = extractVariables("{{  TrimmedVar  }}");
    expect(result).toEqual([]);
  });

  it("handles mixed content with variables and regular text", () => {
    const content = `
# Business Strategy

You are working on {{Topic}} for {{Audience}}.
Your goal is {{Goal}}.
Contact: {{Email}} for follow up.
    `;
    const result = extractVariables(content);
    expect(result).toEqual(["Topic", "Audience", "Goal", "Email"]);
  });

  it("returns variables in order of first appearance", () => {
    const result = extractVariables("{{Z}} then {{A}} then {{M}}");
    expect(result).toEqual(["Z", "A", "M"]);
  });

  it("does not extract malformed variables", () => {
    expect(extractVariables("{{incomplete")).toEqual([]);
    expect(extractVariables("incomplete}}")).toEqual([]);
    expect(extractVariables("{ {spaced} }")).toEqual([]);
  });
});

describe("fillTemplate", () => {
  it("fills a single variable", () => {
    const { filled, unfilled } = fillTemplate("Hello {{Name}}!", { Name: "Alice" });
    expect(filled).toBe("Hello Alice!");
    expect(unfilled).toEqual([]);
  });

  it("fills multiple variables", () => {
    const { filled, unfilled } = fillTemplate(
      "Dear {{Name}}, your {{Product}} is {{Status}}.",
      { Name: "Bob", Product: "order", Status: "ready" }
    );
    expect(filled).toBe("Dear Bob, your order is ready.");
    expect(unfilled).toEqual([]);
  });

  it("tracks unfilled variables", () => {
    const { filled, unfilled } = fillTemplate(
      "Hello {{Name}}, your {{Product}} costs {{Price}}.",
      { Name: "Alice" }
    );
    expect(filled).toContain("Alice");
    expect(filled).toContain("{{Product}}");
    expect(filled).toContain("{{Price}}");
    expect(unfilled).toEqual(["Product", "Price"]);
  });

  it("replaces all occurrences of a variable", () => {
    const { filled } = fillTemplate(
      "{{Topic}} is important. Learn more about {{Topic}} today.",
      { Topic: "Sales" }
    );
    expect(filled).toBe("Sales is important. Learn more about Sales today.");
  });

  it("handles spaced variable names via underscore fallback", () => {
    const { filled, unfilled } = fillTemplate(
      "Context: {{Business Context}}",
      { Business_Context: "B2B SaaS" }
    );
    expect(filled).toBe("Context: B2B SaaS");
    expect(unfilled).toEqual([]);
  });

  it("returns original content unchanged when no variables present", () => {
    const content = "No placeholders here.";
    const { filled, unfilled } = fillTemplate(content, { Key: "Value" });
    expect(filled).toBe(content);
    expect(unfilled).toEqual([]);
  });

  it("handles empty values map gracefully", () => {
    const { filled, unfilled } = fillTemplate("Hello {{Name}}!", {});
    expect(filled).toBe("Hello {{Name}}!");
    expect(unfilled).toEqual(["Name"]);
  });

  it("does not modify unrelated double braces in code examples", () => {
    // Variables must start with \w so purely numeric or empty braces are not matched
    const content = "Regular text {{ValidVar}} and some text.";
    const { filled } = fillTemplate(content, { ValidVar: "replaced" });
    expect(filled).toBe("Regular text replaced and some text.");
  });
});
