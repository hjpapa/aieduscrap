import Parser from "rss-parser";
import { inferNewsCategory, normalizeCategory } from "./categories";
import { isSimilarToAnyTitle } from "./dedupe";
import type { CollectedNewsItem, NewsCategory } from "./types";

type FeedConfig = {
  name: string;
  url: string;
  category?: NewsCategory;
};

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "education-news-insight-agent/0.1",
  },
});

const configuredMaxItemsPerFeed = Number(process.env.NEWS_MAX_ITEMS_PER_FEED ?? 30);
const maxItemsPerFeed =
  Number.isFinite(configuredMaxItemsPerFeed) && configuredMaxItemsPerFeed > 0 ? configuredMaxItemsPerFeed : 30;

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
  {
    name: "Google 뉴스 - 국제 교육",
    url: "https://news.google.com/rss/search?q=%22K-12+education%22+OR+%22elementary+school%22+OR+%22primary+school%22&hl=en-US&gl=US&ceid=US:en",
    category: "기타",
  },
  {
    name: "Google 뉴스 - 국제 AI교육",
    url: "https://news.google.com/rss/search?q=%22AI+in+schools%22+OR+%22AI+education%22+OR+%22artificial+intelligence+classroom%22&hl=en-US&gl=US&ceid=US:en",
    category: "AI교육",
  },
  {
    name: "Google 뉴스 - 국제 교육정책",
    url: "https://news.google.com/rss/search?q=%22school+policy%22+OR+%22education+policy%22+OECD+OR+UNESCO&hl=en-US&gl=US&ceid=US:en",
    category: "교육정책",
  },
  {
    name: "Google 뉴스 - 국제 디지털교육",
    url: "https://news.google.com/rss/search?q=%22digital+learning%22+school+OR+%22edtech%22+classroom&hl=en-US&gl=US&ceid=US:en",
    category: "디지털교육",
  },
  {
    name: "Google 뉴스 - 국제 학생지원",
    url: "https://news.google.com/rss/search?q=%22student+wellbeing%22+school+OR+%22school+discipline%22+OR+%22student+mental+health%22&hl=en-US&gl=US&ceid=US:en",
    category: "생활지도",
  },
  {
    name: "Google 뉴스 - 국제 교육평가",
    url: "https://news.google.com/rss/search?q=%22student+assessment%22+school+OR+%22learning+assessment%22+OR+%22standardized+testing%22&hl=en-US&gl=US&ceid=US:en",
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

async function fetchFeedXml(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
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

async function collectFeed(feed: FeedConfig) {
  const xml = await fetchFeedXml(feed.url);
  const parsed = await parser.parseString(xml);

  return parsed.items.slice(0, maxItemsPerFeed).flatMap((item) => {
    const url = item.link?.trim();
    const title = item.title?.trim();

    if (!url || !title) {
      return [];
    }

    return [
      {
        title,
        source: feed.name,
        url,
        published_at: toIsoDate(item.isoDate ?? item.pubDate),
        category: inferNewsCategory(title, feed.category),
      } satisfies CollectedNewsItem,
    ];
  });
}

export async function collectEducationNews() {
  const feeds = getFeedConfigs();
  const collected: CollectedNewsItem[] = [];
  const errors: Array<{ feed: string; message: string }> = [];
  const seen = new Set<string>();
  const seenTitles: string[] = [];
  const results = await Promise.allSettled(feeds.map((feed) => collectFeed(feed)));

  for (const [index, result] of results.entries()) {
    const feed = feeds[index];

    if (result.status === "rejected") {
      errors.push({
        feed: feed.name,
        message: result.reason instanceof Error ? result.reason.message : "Unknown RSS error",
      });
      continue;
    }

    for (const item of result.value) {
      if (seen.has(item.url) || isSimilarToAnyTitle(item.title, seenTitles)) {
        continue;
      }

      seen.add(item.url);
      seenTitles.push(item.title);
      collected.push(item);
    }
  }

  return { items: collected, errors };
}
