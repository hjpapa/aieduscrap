import type { CollectedNewsItem, EducationNews } from "./types";
import { getDisplayTitle, hasTranslatedTitle } from "./newsDisplay";
import { getTrustedSourceLabel } from "./trustedSources";

export function newsInsightPrompt(news: Pick<EducationNews, "title" | "source" | "url" | "published_at">) {
  return [
    "너는 초등교육 현장을 잘 이해하는 교육 뉴스 분석가다.",
    "기사 전문은 제공되지 않는다. 제목, 출처, URL, 발행일만 보고 과장하지 말고 신중하게 작성한다.",
    "사실 요약과 교사 관점 해석을 반드시 구분한다.",
    "원문 링크 확인이 필요할 수 있음을 전제로, 확인되지 않은 세부 사실을 지어내지 않는다.",
    "JSON만 반환한다. 키는 translated_title, category, summary, teacher_insight, school_action, importance다.",
    "translated_title은 제목이 한국어가 아니면 자연스러운 한국어 번역 제목을 작성하고, 이미 한국어 제목이면 null로 둔다.",
    "category는 AI교육, 교육정책, 디지털교육, 생활지도, 평가, 기타 중 하나다.",
    "importance는 low, medium, high 중 하나다.",
    "",
    `제목: ${news.title}`,
    `출처: ${news.source}`,
    `URL: ${news.url}`,
    `발행일: ${news.published_at}`,
  ].join("\n");
}

export function dailyBriefingPrompt(items: Array<EducationNews | CollectedNewsItem>) {
  const lines = items.map((item, index) => {
    const analyzed = "summary" in item;
    return [
      `${index + 1}. ${getDisplayTitle(item)}`,
      hasTranslatedTitle(item) ? `원제: ${item.title}` : null,
      "translated_title" in item && item.translated_title ? `한국어 제목: ${item.translated_title}` : null,
      `출처: ${item.source}`,
      getTrustedSourceLabel(item) ? `신뢰 출처 유형: ${getTrustedSourceLabel(item)}` : null,
      `카테고리: ${item.category}`,
      `URL: ${item.url}`,
      `발행일: ${item.published_at}`,
      analyzed && item.summary ? `사실 요약: ${item.summary}` : null,
      analyzed && item.teacher_insight ? `교사 관점: ${item.teacher_insight}` : null,
      analyzed && item.school_action ? `학교 적용: ${item.school_action}` : null,
      analyzed && item.importance ? `중요도: ${item.importance}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "너는 초등교사를 위한 아침 교육 뉴스 브리핑 편집자다.",
    "기사 전문을 저장하거나 재현하지 않는다. 제공된 메타데이터와 AI 분석 결과만 사용한다.",
    "오늘 교사가 빠르게 이해할 수 있도록 사실 요약, 교사 관점 해석, 학교 적용 아이디어를 분리해 작성한다.",
    "공식 기관, 국제기구, 전문 교육매체의 뉴스는 우선 검토하되, 제목과 저장된 요약 이상으로 사실을 확대하지 않는다.",
    "각 항목에는 원문 URL을 포함한다.",
    "최종 결과는 한국어 Markdown 본문으로 작성한다.",
    "",
    ...lines,
  ].join("\n\n");
}

export function batchNewsInsightPrompt(news: EducationNews[]) {
  const lines = news.map((item, index) =>
    [
      `${index + 1}.`,
      `id: ${item.id}`,
      `제목: ${item.title}`,
      item.translated_title ? `기존 한국어 제목: ${item.translated_title}` : null,
      `출처: ${item.source}`,
      getTrustedSourceLabel(item) ? `신뢰 출처 유형: ${getTrustedSourceLabel(item)}` : null,
      `카테고리 후보: ${item.category ?? "기타"}`,
      `URL: ${item.url}`,
      `발행일: ${item.published_at}`,
    ].filter(Boolean).join("\n"),
  );

  return [
    "너는 초등교육 현장을 잘 이해하는 교육 뉴스 분석가다.",
    "기사 전문은 제공되지 않는다. 제목, 출처, URL, 발행일만 보고 과장하지 말고 신중하게 작성한다.",
    "사실 요약과 교사 관점 해석을 반드시 구분한다.",
    "확인되지 않은 세부 사실을 지어내지 않는다.",
    "공식 기관, 국제기구, 전문 교육매체에서 나온 AI교육/디지털교육/교육정책 뉴스는 중요도 판단에서 더 주의 깊게 본다.",
    "JSON만 반환한다. 최상위 키는 items이고 값은 배열이다.",
    "각 배열 항목은 id, translated_title, category, summary, teacher_insight, school_action, importance를 포함한다.",
    "translated_title은 제목이 한국어가 아니면 자연스러운 한국어 번역 제목을 작성하고, 이미 한국어 제목이면 null로 둔다.",
    "category는 AI교육, 교육정책, 디지털교육, 생활지도, 평가, 기타 중 하나다.",
    "importance는 low, medium, high 중 하나다.",
    "",
    ...lines,
  ].join("\n\n");
}
