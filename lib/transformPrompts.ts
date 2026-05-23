import { roleLabels, roleSystemPrompts } from "./rolePrompts";
import type { EducationNews, OutputType, RoleType } from "./types";

export const outputTypeLabels: Record<OutputType, string> = {
  report_summary: "보고용 요약",
  training_intro: "교직원 연수 도입부",
  lesson_idea: "수업 아이디어",
  parent_notice: "학부모 안내문",
  checklist: "체크리스트",
};

export function normalizeOutputType(value: unknown): OutputType {
  return ["report_summary", "training_intro", "lesson_idea", "parent_notice", "checklist"].includes(String(value))
    ? (value as OutputType)
    : "report_summary";
}

function newsBlock(news: EducationNews[]) {
  return news
    .map(
      (item, index) => `${index + 1}. ${item.title}
출처: ${item.source}
URL: ${item.url}
발행일: ${item.published_at}
카테고리: ${item.category ?? "기타"}
사실 요약: ${item.summary ?? "저장된 요약 없음"}
교사 관점 통찰: ${item.teacher_insight ?? "저장된 통찰 없음"}
학교 적용 아이디어: ${item.school_action ?? "저장된 아이디어 없음"}
중요도: ${item.importance ?? "medium"}`,
    )
    .join("\n\n");
}

export function transformPrompt(outputType: OutputType, roleType: RoleType, news: EducationNews[]) {
  const label = outputTypeLabels[outputType];
  const roleLabel = roleLabels[roleType];

  return [
    roleSystemPrompts[roleType],
    "",
    `역할: ${roleLabel}`,
    `생성할 산출물: ${label}`,
    "",
    "중요 원칙:",
    "- 아래에 제공된 저장 뉴스 데이터만 근거로 사용한다.",
    "- 기사 전문은 제공되지 않았고 저장하지 않는다.",
    "- 확인되지 않은 사실을 단정하지 않는다.",
    "- 근거가 되는 뉴스의 제목, 출처, URL을 반드시 포함한다.",
    "- '뉴스에 근거한 내용'과 'AI 해석/제안'을 구분한다.",
    "",
    "산출물 형식:",
    outputType === "report_summary" ? "- 핵심 요약, 학교 영향, 검토 필요사항, 참고 뉴스 순서로 작성한다." : "",
    outputType === "training_intro" ? "- 3분 이내 연수 도입 멘트, 질문 2개, 연결할 참고 뉴스 순서로 작성한다." : "",
    outputType === "lesson_idea" ? "- 수업 목표, 활동 흐름, 교사 발문, 주의사항, 참고 뉴스 순서로 작성한다." : "",
    outputType === "parent_notice" ? "- 학부모에게 보내는 부드러운 안내문 형식으로 작성하되 과장하지 않는다." : "",
    outputType === "checklist" ? "- 교사가 바로 점검할 수 있는 체크리스트 형식으로 작성한다." : "",
    "",
    "저장 뉴스 데이터:",
    newsBlock(news),
  ]
    .filter(Boolean)
    .join("\n");
}
