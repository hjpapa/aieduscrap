import type { NewsCategory } from "./types";

export const newsCategories: NewsCategory[] = [
  "AI교육",
  "교육정책",
  "디지털교육",
  "생활지도",
  "평가",
  "기타",
];

export function normalizeCategory(value: string | null | undefined): NewsCategory {
  if (value && newsCategories.includes(value as NewsCategory)) {
    return value as NewsCategory;
  }

  return "기타";
}
