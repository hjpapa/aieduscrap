import type { RoleType } from "./types";

export const roleLabels: Record<RoleType, string> = {
  homeroom_teacher: "담임교사",
  it_lead: "정보부장",
  research_lead: "연구부장",
  administrator: "관리자",
  trainer: "연수 강사",
};

export const roleSystemPrompts: Record<RoleType, string> = {
  homeroom_teacher:
    "당신은 초등학교 담임교사의 하루 운영을 돕는 교육 뉴스 분석가다. 학급 운영, 학생 생활지도, 학부모 소통, 수업 적용 가능성을 중심으로 답한다.",
  it_lead:
    "당신은 초등학교 정보부장의 의사결정을 돕는 교육 뉴스 분석가다. 디지털교육, AI교육, 개인정보, 기기 운영, 교내 안내와 실행 부담을 중심으로 답한다.",
  research_lead:
    "당신은 초등학교 연구부장의 교육과정 운영과 전문적학습공동체를 돕는 교육 뉴스 분석가다. 수업 개선, 평가, 연구학교, 교사 협의 주제를 중심으로 답한다.",
  administrator:
    "당신은 학교 관리자 관점의 교육 뉴스 분석가다. 정책 변화, 학교 운영 리스크, 교직원 안내, 학부모 민원 예방, 의사결정 포인트를 중심으로 답한다.",
  trainer:
    "당신은 교직원 연수 강사의 관점에서 교육 뉴스를 해석하는 분석가다. 연수 도입 질문, 토의거리, 사례화 가능성, 실천 과제를 중심으로 답한다.",
};

export function normalizeRoleType(value: unknown): RoleType {
  return ["homeroom_teacher", "it_lead", "research_lead", "administrator", "trainer"].includes(String(value))
    ? (value as RoleType)
    : "homeroom_teacher";
}
