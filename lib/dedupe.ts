import type { EducationNews } from "./types";

export function normalizeNewsTitle(title: string) {
  return title
    .replace(/\s+-\s+.+$/u, "")
    .replace(/\[[^\]]+\]/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function tokenizeNewsTitle(title: string) {
  return new Set(
    normalizeNewsTitle(title)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

export function areSimilarNewsTitles(a: string, b: string) {
  const normalizedA = normalizeNewsTitle(a);
  const normalizedB = normalizeNewsTitle(b);

  if (!normalizedA || !normalizedB) {
    return false;
  }

  if (normalizedA === normalizedB) {
    return true;
  }

  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    const shorter = Math.min(normalizedA.length, normalizedB.length);
    const longer = Math.max(normalizedA.length, normalizedB.length);
    return shorter >= 18 && shorter / longer >= 0.68;
  }

  const tokensA = tokenizeNewsTitle(normalizedA);
  const tokensB = tokenizeNewsTitle(normalizedB);

  if (tokensA.size < 3 || tokensB.size < 3) {
    return false;
  }

  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  return union > 0 && intersection / union >= 0.62;
}

export function isSimilarToAnyTitle(title: string, existingTitles: string[]) {
  return existingTitles.some((existingTitle) => areSimilarNewsTitles(title, existingTitle));
}

export function dedupeNewsForDisplay(news: EducationNews[]) {
  const kept: EducationNews[] = [];
  const removed: EducationNews[] = [];

  for (const item of news) {
    const isDuplicate = kept.some((existing) => areSimilarNewsTitles(item.title, existing.title));

    if (isDuplicate) {
      removed.push(item);
    } else {
      kept.push(item);
    }
  }

  return { kept, removed };
}
