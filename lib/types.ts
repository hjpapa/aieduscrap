export type Importance = "low" | "medium" | "high";

export type NewsCategory = "AI교육" | "교육정책" | "디지털교육" | "생활지도" | "평가" | "기타";

export type EducationNews = {
  id: string;
  title: string;
  translated_title?: string | null;
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
  translated_title?: string | null;
  category: NewsCategory;
  summary: string;
  teacher_insight: string;
  school_action: string;
  importance: Importance;
};

export type BatchNewsInsight = NewsInsight & {
  id: string;
};

export type RoleType = "homeroom_teacher" | "it_lead" | "research_lead" | "administrator" | "trainer";

export type AgentPeriod = "today" | "3d" | "1w" | "1m";

export type OutputType = "report_summary" | "training_intro" | "lesson_idea" | "parent_notice" | "checklist";

export type NewsReference = Pick<
  EducationNews,
  "id" | "title" | "translated_title" | "source" | "url" | "published_at" | "category" | "importance"
>;
