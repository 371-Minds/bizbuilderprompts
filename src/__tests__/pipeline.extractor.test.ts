import { describe, it, expect } from "vitest";
import {
  parseExtractionResponse,
  parseScoreArray,
  EXTRACTION_SYSTEM_PROMPT,
} from "../pipeline/extractor.js";
import { isPrivateIp, assertPublicUrl, SsrfBlockedError } from "../utils/url-guard.js";

describe("EXTRACTION_SYSTEM_PROMPT — contract", () => {
  it("requires methodologies, forbids personas", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/methodolog/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/not.*people|not a persona|never.*persona/i);
  });

  it("demands concrete content and forbids placeholders", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/CONCRETE/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/\{\{variable\}\}|\{\{.*placeholder/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/never use \{\{variable\}\}|no \{\{|placeholders/i);
  });

  it("requires a verbatim sourceQuote as the verification anchor", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/sourceQuote/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/verbatim/i);
  });

  it("forbids inventing when nothing is extractable", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/never invent|never invent/i);
  });
});

describe("parseExtractionResponse", () => {
  it("parses a clean {items:[...]} response", () => {
    const raw = JSON.stringify({
      items: [
        {
          type: "prompt",
          topic: "Pre-mortem Decision Framework",
          goal: "Surface risks before committing to a decision",
          content:
            "Before finalizing any decision, convene the team and ask: 'Assume this failed spectacularly in 12 months. What went wrong?' " +
            "Collect every named failure mode, cluster them, then for each cluster assign an owner and a cheap mitigation. " +
            "Only proceed once the top three clusters have mitigations.",
          tags: ["decision-making", "risk", "facilitation"],
          sourceQuote: "Before finalizing any decision, assume it failed and work backward.",
        },
      ],
    });
    const assets = parseExtractionResponse(raw);
    expect(assets).toHaveLength(1);
    expect(assets[0].topic).toBe("Pre-mortem Decision Framework");
    expect(assets[0].type).toBe("prompt");
    expect(assets[0].content.length).toBeGreaterThan(40);
    expect(assets[0].sourceQuote).toBeTruthy();
    expect(assets[0].confidence).toBe(0); // filled by pre-score, not parse
  });

  it("strips ```json fences", () => {
    const raw = '```json\n{"items":[{"type":"prompt","topic":"T","goal":"G","content":"' +
      "a".repeat(50) + '","sourceQuote":"q"}]}\n```';
    const assets = parseExtractionResponse(raw);
    expect(assets).toHaveLength(1);
    expect(assets[0].topic).toBe("T");
  });

  it("accepts a bare array as the response body", () => {
    const raw = JSON.stringify([
      { type: "workflow", topic: "W", goal: "G", content: "b".repeat(50), sourceQuote: "q" },
    ]);
    const assets = parseExtractionResponse(raw);
    expect(assets).toHaveLength(1);
    expect(assets[0].type).toBe("workflow");
  });

  it("drops items missing sourceQuote (verification anchor is mandatory)", () => {
    const raw = JSON.stringify({
      items: [
        { type: "prompt", topic: "Good", goal: "g", content: "c".repeat(50), sourceQuote: "q" },
        { type: "prompt", topic: "No quote", goal: "g", content: "c".repeat(50) }, // no sourceQuote
      ],
    });
    const assets = parseExtractionResponse(raw);
    expect(assets).toHaveLength(1);
    expect(assets[0].topic).toBe("Good");
  });

  it("drops items whose content is placeholder scaffolding (factory's job, not ours)", () => {
    const raw = JSON.stringify({
      items: [
        { type: "prompt", topic: "Scaffold", goal: "g", content: "Fill in {{Topic}} for {{Audience}}", sourceQuote: "q" },
        { type: "prompt", topic: "Real", goal: "g", content: "x".repeat(50), sourceQuote: "q" },
      ],
    });
    const assets = parseExtractionResponse(raw);
    expect(assets).toHaveLength(1);
    expect(assets[0].topic).toBe("Real");
  });

  it("drops items with too-short content (<40 chars)", () => {
    const raw = JSON.stringify({
      items: [{ type: "prompt", topic: "T", goal: "g", content: "short", sourceQuote: "q" }],
    });
    expect(parseExtractionResponse(raw)).toHaveLength(0);
  });

  it("rejects unknown types", () => {
    const raw = JSON.stringify({
      items: [{ type: "persona", topic: "T", goal: "g", content: "c".repeat(50), sourceQuote: "q" }],
    });
    expect(parseExtractionResponse(raw)).toHaveLength(0);
  });

  it("returns [] on empty {items:[]}", () => {
    expect(parseExtractionResponse('{"items":[]}')).toEqual([]);
  });

  it("returns [] on garbage", () => {
    expect(parseExtractionResponse("not json at all")).toEqual([]);
    expect(parseExtractionResponse("")).toEqual([]);
  });

  it("normalizes a valid framework, drops invalid ones", () => {
    const raw = JSON.stringify({
      items: [
        { type: "workflow", topic: "DSF", goal: "g", content: "c".repeat(50), sourceQuote: "q", framework: "dsf" },
        { type: "workflow", topic: "Bogus", goal: "g", content: "c".repeat(50), sourceQuote: "q", framework: "six-sigma" },
      ],
    });
    const assets = parseExtractionResponse(raw);
    expect(assets[0].framework).toBe("dsf");
    expect(assets[1].framework).toBeUndefined();
  });

  it("lowercases + caps tags at 6", () => {
    const raw = JSON.stringify({
      items: [{
        type: "prompt", topic: "T", goal: "g", content: "c".repeat(50), sourceQuote: "q",
        tags: ["Sales", "MARKETING", "a", "b", "c", "d", "e", "f"],
      }],
    });
    const assets = parseExtractionResponse(raw);
    expect(assets[0].tags).toEqual(["sales", "marketing", "a", "b", "c", "d"]);
  });
});

describe("parseScoreArray", () => {
  it("parses a clean number array", () => {
    expect(parseScoreArray("[0.91, 0.42, 0.78]", 3)).toEqual([0.91, 0.42, 0.78]);
  });

  it("pads with zeros when the array is short", () => {
    expect(parseScoreArray("[0.5]", 3)).toEqual([0.5, 0, 0]);
  });

  it("clamps to [0,1]", () => {
    expect(parseScoreArray("[1.5, -0.2]", 2)).toEqual([1, 0]);
  });

  it("returns all-zeros on garbage", () => {
    expect(parseScoreArray("not json", 3)).toEqual([0, 0, 0]);
  });
});

describe("isPrivateIp", () => {
  it("blocks loopback", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("blocks private ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
  });

  it("blocks link-local (AWS metadata endpoint)", () => {
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  it("blocks CGNAT / Tailscale range", () => {
    expect(isPrivateIp("100.64.0.1")).toBe(true);
  });

  it("allows public IPs", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });

  it("blocks 172.32.x (just outside the private range)", () => {
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(SsrfBlockedError);
    await expect(assertPublicUrl("gopher://x.com")).rejects.toThrow(SsrfBlockedError);
  });

  it("rejects malformed URLs", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toThrow(SsrfBlockedError);
  });

  it("rejects a literal loopback IP", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/secret")).rejects.toThrow(SsrfBlockedError);
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(SsrfBlockedError);
  });
});
