import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAIClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 4096;
