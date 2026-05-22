import OpenAI from "openai";

let openai: OpenAI | null = null;

export function getOpenAI() {
  if (openai) {
    return openai;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openai;
}

export const openAIModel = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
