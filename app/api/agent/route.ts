import { NextResponse } from "next/server";
import { generateText, getAIProvider } from "@/lib/ai";
import { roleLabels, normalizeRoleType, roleSystemPrompts } from "@/lib/rolePrompts";
import { normalizePeriod, searchNews } from "@/lib/searchNews";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EducationNews, NewsReference } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type AgentStructuredAnswer = {
  headline: string;
  briefAnswer: string;
  evidenceCards: Array<{
    newsId: string;
    pointTitle: string;
    factSummary: string;
    teacherInterpretation: string;
    schoolAction: string;
  }>;
  nextSteps: string[];
  cautions: string[];
};

function toReferences(news: EducationNews[]): NewsReference[] {
  return news.map((item) => ({
    id: item.id,
    title: item.title,
    translated_title: item.translated_title,
    source: item.source,
    url: item.url,
    published_at: item.published_at,
    category: item.category,
    importance: item.importance,
  }));
}

function buildAgentPrompt({
  message,
  roleType,
  news,
}: {
  message: string;
  roleType: ReturnType<typeof normalizeRoleType>;
  news: EducationNews[];
}) {
  const roleLabel = roleLabels[roleType];
  const newsLines = news.map((item, index) =>
    [
      `${index + 1}. ${item.title}`,
      item.translated_title ? `한국어 제목: ${item.translated_title}` : null,
      `id: ${item.id}`,
      `출처: ${item.source}`,
      `URL: ${item.url}`,
      `발행일: ${item.published_at}`,
      `카테고리: ${item.category ?? "기타"}`,
      `중요도: ${item.importance ?? "medium"}`,
      `사실 요약: ${item.summary ?? "저장된 요약 없음"}`,
      `교사 관점 통찰: ${item.teacher_insight ?? "저장된 통찰 없음"}`,
      `학교 적용 아이디어: ${item.school_action ?? "저장된 아이디어 없음"}`,
    ].filter(Boolean).join("\n"),
  );

  return [
    roleSystemPrompts[roleType],
    "",
    `사용자 역할 관점: ${roleLabel}`,
    `사용자 질문: ${message}`,
    "",
    "답변 원칙:",
    "- 아래 저장 뉴스 데이터만 근거로 사용한다.",
    "- 기사 전문은 저장되어 있지 않으므로 제목, 출처, URL, 발행일, AI 요약/통찰 범위 안에서만 말한다.",
    "- 확인되지 않은 사실은 단정하지 말고 '저장된 뉴스 기준으로는', '추가 확인이 필요합니다'처럼 표현한다.",
    "- '뉴스에 근거한 내용'과 'AI 해석/제안'을 구분한다.",
    "- Markdown 문서를 만들지 않는다.",
    "- 반드시 JSON만 반환한다.",
    "- 답변은 프론트엔드 카드 UI에서 표시할 수 있도록 짧은 문장 단위로 구조화한다.",
    "- evidenceCards의 newsId는 반드시 아래 저장 뉴스 데이터의 id 중 하나를 사용한다.",
    "- evidenceCards는 최대 4개로 제한한다.",
    "- nextSteps는 바로 실행 가능한 짧은 항목 2~5개로 작성한다.",
    "- cautions에는 단정하지 말아야 할 점이나 원문 확인 필요성을 1~3개 작성한다.",
    "",
    "JSON 형식:",
    "{",
    '  "headline": "답변 제목",',
    '  "briefAnswer": "질문에 대한 한 단락 요약",',
    '  "evidenceCards": [',
    "    {",
    '      "newsId": "참고 뉴스 id",',
    '      "pointTitle": "핵심 포인트 제목",',
    '      "factSummary": "뉴스에 근거한 내용",',
    '      "teacherInterpretation": "교사 관점 해석",',
    '      "schoolAction": "학교 적용 아이디어"',
    "    }",
    "  ],",
    '  "nextSteps": ["실행 항목"],',
    '  "cautions": ["주의 또는 원문 확인 필요사항"]',
    "}",
    "",
    "저장 뉴스 데이터:",
    newsLines.join("\n\n"),
  ].join("\n");
}

function parseJson<T>(text: string): T {
  return JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "")) as T;
}

function normalizeStructuredAnswer(answer: Partial<AgentStructuredAnswer>, fallbackNews: EducationNews[]): AgentStructuredAnswer {
  const validIds = new Set(fallbackNews.map((item) => item.id));
  const evidenceCards = Array.isArray(answer.evidenceCards)
    ? answer.evidenceCards
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          newsId: typeof item.newsId === "string" && validIds.has(item.newsId) ? item.newsId : fallbackNews[0]?.id ?? "",
          pointTitle: typeof item.pointTitle === "string" ? item.pointTitle : "확인할 교육 뉴스",
          factSummary: typeof item.factSummary === "string" ? item.factSummary : "저장된 뉴스 기준으로 확인이 필요합니다.",
          teacherInterpretation:
            typeof item.teacherInterpretation === "string" ? item.teacherInterpretation : "교사 관점 해석을 신중히 검토해야 합니다.",
          schoolAction: typeof item.schoolAction === "string" ? item.schoolAction : "원문을 확인한 뒤 학교 상황에 맞게 적용합니다.",
        }))
        .slice(0, 4)
    : [];

  return {
    headline: typeof answer.headline === "string" ? answer.headline : "저장 뉴스 기반 답변",
    briefAnswer:
      typeof answer.briefAnswer === "string"
        ? answer.briefAnswer
        : "선택한 기간의 저장 뉴스 데이터를 바탕으로 관련 내용을 정리했습니다.",
    evidenceCards,
    nextSteps: Array.isArray(answer.nextSteps)
      ? answer.nextSteps.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [],
    cautions: Array.isArray(answer.cautions)
      ? answer.cautions.filter((item): item is string => typeof item === "string").slice(0, 3)
      : ["기사 전문이 아닌 저장된 메타데이터와 AI 요약을 바탕으로 한 답변입니다."],
  };
}

async function saveConversation({
  message,
  roleType,
  period,
  answer,
  newsIds,
}: {
  message: string;
  roleType: string;
  period: string;
  answer: string;
  newsIds: string[];
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("agent_conversations").insert({
      message,
      role_type: roleType,
      period,
      answer,
      referenced_news_ids: newsIds,
    });

    return !error;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: unknown;
      roleType?: unknown;
      period?: unknown;
    };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const roleType = normalizeRoleType(body.roleType);
    const period = normalizePeriod(body.period);

    if (!message) {
      return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
    }

    const news = await searchNews({ message, period, limit: 12 });
    const references = toReferences(news);

    if (news.length === 0) {
      const structuredAnswer: AgentStructuredAnswer = {
        headline: "관련 저장 뉴스가 없습니다",
        briefAnswer:
          "선택한 기간 안에서 질문과 연결할 수 있는 저장 뉴스가 없습니다. 기간을 넓히거나 뉴스 수집 후 다시 질문해주세요.",
        evidenceCards: [],
        nextSteps: ["검색 기간을 최근 1주일 또는 최근 1개월로 넓혀봅니다.", "뉴스 수집과 브리핑 생성을 먼저 실행합니다."],
        cautions: ["저장된 뉴스가 없으므로 AI가 근거 답변을 만들 수 없습니다."],
      };
      const answer = JSON.stringify(structuredAnswer);

      return NextResponse.json({
        answer,
        structuredAnswer,
        references,
        provider: getAIProvider(),
        saved: false,
      });
    }

    const rawAnswer = await generateText(buildAgentPrompt({ message, roleType, news }), {
      json: true,
      temperature: 0.25,
    });
    const structuredAnswer = normalizeStructuredAnswer(parseJson<Partial<AgentStructuredAnswer>>(rawAnswer), news);
    const answer = JSON.stringify(structuredAnswer);
    const saved = await saveConversation({
      message,
      roleType,
      period,
      answer,
      newsIds: references.map((item) => item.id),
    });

    return NextResponse.json({
      answer,
      structuredAnswer,
      references,
      provider: getAIProvider(),
      saved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요. (${error.message})`
            : "답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 },
    );
  }
}
