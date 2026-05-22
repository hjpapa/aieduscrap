import { normalizeCategory } from "./categories";
import { getOpenAI, openAIModel } from "./openai";
import type { BatchNewsInsight, EducationNews, NewsInsight } from "./types";

type TextGenerationOptions = {
  json?: boolean;
  temperature: number;
};

export function getAIProvider() {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  if (provider === "gemini" || provider === "openai") {
    return provider;
  }

  return process.env.GEMINI_API_KEY ? "gemini" : "openai";
}

function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  return JSON.parse(trimmed) as T;
}

async function generateWithOpenAI(prompt: string, options: TextGenerationOptions) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: openAIModel,
    temperature: options.temperature,
    response_format: options.json ? { type: "json_object" } : undefined,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return content;
}

async function generateWithGemini(prompt: string, options: TextGenerationOptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature,
        ...(options.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Gemini API error: HTTP ${response.status}`);
  }

  const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

  if (!content) {
    throw new Error("Gemini returned an empty response");
  }

  return content;
}

export async function generateText(prompt: string, options: TextGenerationOptions) {
  return getAIProvider() === "gemini" ? generateWithGemini(prompt, options) : generateWithOpenAI(prompt, options);
}

export async function generateNewsInsight(news: EducationNews, prompt: string) {
  const content = await generateText(prompt, {
    json: true,
    temperature: 0.2,
  });
  const insight = parseJson<NewsInsight>(content);

  return {
    ...insight,
    category: normalizeCategory(insight.category),
    importance: ["low", "medium", "high"].includes(insight.importance) ? insight.importance : "medium",
  } satisfies NewsInsight;
}

export async function generateBatchNewsInsights(prompt: string) {
  const content = await generateText(prompt, {
    json: true,
    temperature: 0.2,
  });
  const parsed = parseJson<{ items: BatchNewsInsight[] } | BatchNewsInsight[]>(content);
  const items = Array.isArray(parsed) ? parsed : parsed.items;

  if (!Array.isArray(items)) {
    throw new Error("AI returned an invalid batch insight response");
  }

  return items.map((insight) => ({
    ...insight,
    category: normalizeCategory(insight.category),
    importance: ["low", "medium", "high"].includes(insight.importance) ? insight.importance : "medium",
  })) satisfies BatchNewsInsight[];
}

export function isAIQuotaError(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && error.status === 429) {
    return true;
  }

  return error instanceof Error && /quota|rate limit|resource exhausted|429/i.test(error.message);
}
