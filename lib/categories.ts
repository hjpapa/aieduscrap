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

function hasKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function inferNewsCategory(title: string, fallback?: string | null): NewsCategory {
  const text = title.replace(/\s+/g, "").toLowerCase();
  const normalizedFallback = normalizeCategory(fallback);

  if (
    hasKeyword(text, [
      "ai교육",
      "인공지능교육",
      "생성형ai",
      "챗gpt",
      "chatgpt",
      "gemini",
      "ai활용",
      "ai교과서",
      "aieducation",
      "aiinschools",
      "artificialintelligence",
      "machinelearning",
    ])
  ) {
    return "AI교육";
  }

  if (
    hasKeyword(text, [
      "디지털교육",
      "디지털교과서",
      "에듀테크",
      "스마트교육",
      "온라인수업",
      "원격수업",
      "코딩교육",
      "소프트웨어교육",
      "sw교육",
      "정보교육",
      "디지털역량",
      "digitallearning",
      "edtech",
      "onlinelearning",
      "classroomtechnology",
    ])
  ) {
    return "디지털교육";
  }

  if (
    hasKeyword(text, [
      "생활지도",
      "학생생활",
      "학교폭력",
      "학폭",
      "교권",
      "상담",
      "위기학생",
      "정서행동",
      "마음건강",
      "인성교육",
      "출결",
      "studentwellbeing",
      "studentmentalhealth",
      "schooldiscipline",
    ])
  ) {
    return "생활지도";
  }

  if (
    hasKeyword(text, [
      "교육평가",
      "평가",
      "학업성취",
      "진단평가",
      "수행평가",
      "서논술형",
      "수능",
      "내신",
      "성취도",
      "기초학력",
      "studentassessment",
      "learningassessment",
      "standardizedtesting",
    ])
  ) {
    return "평가";
  }

  if (
    hasKeyword(text, [
      "교육부",
      "교육청",
      "교육감",
      "정책",
      "장관",
      "예산",
      "법안",
      "개정",
      "고시",
      "늘봄",
      "유보통합",
      "교원",
      "educationpolicy",
      "schoolpolicy",
      "oecd",
      "unesco",
    ])
  ) {
    return "교육정책";
  }

  return normalizedFallback;
}
