export type Importance = "low" | "medium" | "high";

export type NewsCategory = "AI교육" | "교육정책" | "디지털교육" | "생활지도" | "평가" | "기타";

export type EducationNews = {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  category: NewsCategory | string | null;
  summary: string | null;
  teacher_insight: string | null;
  school_action: string | null;
  importance: Importance | null;
  created_at: string;
};

export type DailyBriefing = {
  id: string;
  briefing_date: string;
  title: string;
  content: string;
  created_at: string;
};

export type CollectedNewsItem = {
  title: string;
  source: string;
  url: string;
  published_at: string;
  category: NewsCategory;
};

export type NewsInsight = {
  category: NewsCategory;
  summary: string;
  teacher_insight: string;
  school_action: string;
  importance: Importance;
};

export type BatchNewsInsight = NewsInsight & {
  id: string;
};
