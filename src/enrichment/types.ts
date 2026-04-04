export type RawInputType = "url" | "file" | "text" | "transcript";

export interface RawInput {
  type: RawInputType;
  payload: string;
  context?: string;
}

export interface EnrichedInput {
  rawInput: RawInput;
  extractedTitle: string;
  bodyText: string;
  detectedTopics: string[];
  suggestedAssetTypes: string[];
  keyEntities: string[];
  wordCount: number;
  language: string;
}
