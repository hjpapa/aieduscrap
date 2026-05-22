import Parser from "rss-parser";
import { inferNewsCategory, normalizeCategory } from "./categories";
import type { CollectedNewsItem, NewsCategory } from "./types";

type FeedConfig = {
  name: string;
  url: string;
  category?: NewsCategory;
};

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "education-news-insight-agent/0.1",
  },
});

const defaultFeeds: FeedConfig[] = [
  {
    name: "교육부 정책브리핑",
    url: "https://www.korea.kr/rss/dept_moe.xml",
    category: "교육정책",
  },
  {
    name: "Google 뉴스 - 교육",
    url: "https://news.google.com/rss/search?q=%EA%B5%90%EC%9C%A1&hl=ko&gl=KR&ceid=KR:ko",
    category: "기타",
  },
  {
    name: "Google 뉴스 - AI교육",
    url: "https://news.google.com/rss/search?q=AI%EA%B5%90%EC%9C%A1&hl=ko&gl=KR&ceid=KR:ko",
    category: "AI교육",
  },
  {
    name: "Google 뉴스 - 디지털교육",
    url: "https://news.google.com/rss/search?q=%EB%94%94%EC%A7%80%ED%84%B8%EA%B5%90%EC%9C%A1&hl=ko&gl=KR&ceid=KR:ko",
    category: "디지털교육",
  },
  {
    name: "Google 뉴스 - 생활지도",
    url: "https://news.google.com/rss/search?q=%EC%83%9D%ED%99%9C%EC%A7%80%EB%8F%84+%ED%95%99%EA%B5%90&hl=ko&gl=KR&ceid=KR:ko",
    category: "생활지도",
  },
  {
    name: "Google 뉴스 - 교육평가",
    url: "https://news.google.com/rss/search?q=%EA%B5%90%EC%9C%A1%ED%8F%89%EA%B0%80+%ED%95%99%EA%B5%90&hl=ko&gl=KR&ceid=KR:ko",
    category: "평가",
  },
];

function getFeedConfigs() {
  const raw = process.env.NEWS_RSS_FEEDS;

  if (!raw) {
    return defaultFeeds;
  }

  try {
    const parsed = JSON.parse(raw) as Array<Omit<FeedConfig, "category"> & { category?: string }>;
    if (Array.isArray(parsed) && parsed.every((feed) => feed.name && feed.url)) {
      return parsed.map((feed) => ({
        ...feed,
        category: normalizeCategory(feed.category),
      }));
    }
  } catch {
    return raw
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ name: new URL(url).hostname, url, category: "기타" as const }));
  }

  return defaultFeeds;
}

function toIsoDate(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeTitle(title: string) {
  return title
    .replace(/\s+-\s+.+$/u, "")
    .replace(/\[[^\]]+\]/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenizeTitle(title: string) {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function isSimilarTitle(title: string, existingTitles: string[]) {
  const normalized = normalizeTitle(title);

  if (!normalized) {
    return false;
  }

  for (const existingTitle of existingTitles) {
    const existingNormalized = normalizeTitle(existingTitle);

    if (normalized === existingNormalized) {
      return true;
    }

    const currentTokens = tokenizeTitle(normalized);
    const existingTokens = tokenizeTitle(existingNormalized);

    if (currentTokens.size < 4 || existingTokens.size < 4) {
      continue;
    }

    const intersection = [...currentTokens].filter((token) => existingTokens.has(token)).length;
    const union = new Set([...currentTokens, ...existingTokens]).size;

    if (union > 0 && intersection / union >= 0.72) {
      return true;
    }
  }

  return false;
}

async function fetchFeedXml(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 education-news-insight-agent/0.1",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown RSS fetch error");
}

export async function collectEducationNews() {
  const feeds = getFeedConfigs();
  const collected: CollectedNewsItem[] = [];
  const errors: Array<{ feed: string; message: string }> = [];
  const seen = new Set<string>();
  const seenTitles: string[] = [];

  for (const feed of feeds) {
    try {
      const xml = await fetchFeedXml(feed.url);
      const parsed = await parser.parseString(xml);

      for (const item of parsed.items) {
        const url = item.link?.trim();
        const title = item.title?.trim();

        if (!url || !title || seen.has(url) || isSimilarTitle(title, seenTitles)) {
          continue;
        }

        seen.add(url);
        seenTitles.push(title);
        collected.push({
          title,
          source: feed.name,
          url,
          published_at: toIsoDate(item.isoDate ?? item.pubDate),
          category: inferNewsCategory(title, feed.category),
        });
      }
    } catch (error) {
      errors.push({
        feed: feed.name,
        message: error instanceof Error ? error.message : "Unknown RSS error",
      });
    }
  }

  return { items: collected, errors };
}
