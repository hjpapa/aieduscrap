import { inferNewsCategory, newsCategories } from "./categories";
import { getKstDayRange } from "./date";
import { getDisplayTitle } from "./newsDisplay";
import { getSupabaseAdmin } from "./supabase";
import type { AgentPeriod, EducationNews, Importance } from "./types";

const periodDays: Record<AgentPeriod, number> = {
  today: 1,
  "3d": 3,
  "1w": 7,
  "1m": 30,
};

const importanceScore: Record<Importance, number> = {
  high: 30,
  medium: 16,
  low: 6,
};

export function normalizePeriod(value: unknown): AgentPeriod {
  return ["today", "3d", "1w", "1m"].includes(String(value)) ? (value as AgentPeriod) : "today";
}

function getPeriodRange(period: AgentPeriod) {
  const { date, end } = getKstDayRange();
  const days = periodDays[period];
  const startDate = new Date(`${date}T00:00:00+09:00`);
  startDate.setDate(startDate.getDate() - (days - 1));

  return {
    start: startDate.toISOString(),
    end,
  };
}

function tokenize(message: string) {
  return Array.from(
    new Set(
      message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ).slice(0, 12);
}

function textOf(item: EducationNews) {
  return [item.title, item.translated_title, item.source, item.category, item.summary, item.teacher_insight, item.school_action]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreNews(item: EducationNews, message: string, tokens: string[]) {
  const text = textOf(item);
  const category = inferNewsCategory(item.title, item.category);
  let score = item.importance ? importanceScore[item.importance] : 10;

  for (const token of tokens) {
    if (getDisplayTitle(item).toLowerCase().includes(token) || item.title.toLowerCase().includes(token)) {
      score += 14;
    } else if (text.includes(token)) {
      score += 7;
    }
  }

  if (newsCategories.some((candidate) => message.includes(candidate)) && message.includes(category)) {
    score += 18;
  }

  return score;
}

export async function searchNews({
  message = "",
  period = "today",
  limit = 12,
}: {
  message?: string;
  period?: AgentPeriod;
  limit?: number;
}) {
  const supabase = getSupabaseAdmin();
  const { start, end } = getPeriodRange(period);
  const { data, error } = await supabase
    .from("education_news")
    .select("*")
    .gte("published_at", start)
    .lt("published_at", end)
    .order("published_at", { ascending: false })
    .limit(120);

  if (error) {
    throw error;
  }

  const tokens = tokenize(message);
  const rows = ((data ?? []) as EducationNews[]).map((item) => ({
    item,
    score: scoreNews(item, message, tokens),
  }));

  rows.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return new Date(b.item.published_at).getTime() - new Date(a.item.published_at).getTime();
  });

  return rows.slice(0, limit).map(({ item }) => item);
}

export async function getNewsByIds(newsIds: string[]) {
  if (newsIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("education_news").select("*").in("id", newsIds).limit(30);

  if (error) {
    throw error;
  }

  return (data ?? []) as EducationNews[];
}
