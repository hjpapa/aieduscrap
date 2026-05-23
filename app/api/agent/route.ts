import { NextResponse } from "next/server";
import { generateText, getAIProvider } from "@/lib/ai";
import { roleLabels, normalizeRoleType, roleSystemPrompts } from "@/lib/rolePrompts";
import { normalizePeriod, searchNews } from "@/lib/searchNews";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EducationNews, NewsReference } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function toReferences(news: EducationNews[]): NewsReference[] {
  return news.map((item) => ({
    id: item.id,
    title: item.title,
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
      `id: ${item.id}`,
      `출처: ${item.source}`,
      `URL: ${item.url}`,
      `발행일: ${item.published_at}`,
      `카테고리: ${item.category ?? "기타"}`,
      `중요도: ${item.importance ?? "medium"}`,
      `사실 요약: ${item.summary ?? "저장된 요약 없음"}`,
      `교사 관점 통찰: ${item.teacher_insight ?? "저장된 통찰 없음"}`,
      `학교 적용 아이디어: ${item.school_action ?? "저장된 아이디어 없음"}`,
    ].join("\n"),
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
    "- 마지막에 '참고 뉴스' 섹션을 만들고, 참고한 뉴스의 제목, 출처, URL을 반드시 포함한다.",
    "- 한국어 Markdown으로 간결하게 답한다.",
    "",
    "저장 뉴스 데이터:",
    newsLines.join("\n\n"),
  ].join("\n");
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
      const answer = [
        "선택한 기간 안에서 질문과 연결할 수 있는 저장 뉴스가 없습니다.",
        "",
        "뉴스 수집이 아직 실행되지 않았거나, 질문 범위가 현재 저장된 뉴스와 맞지 않을 수 있습니다. 기간을 넓히거나 `/api/daily-cron` 실행 후 다시 질문해주세요.",
      ].join("\n");

      return NextResponse.json({
        answer,
        references,
        provider: getAIProvider(),
        saved: false,
      });
    }

    const answer = await generateText(buildAgentPrompt({ message, roleType, news }), {
      temperature: 0.25,
    });
    const saved = await saveConversation({
      message,
      roleType,
      period,
      answer,
      newsIds: references.map((item) => item.id),
    });

    return NextResponse.json({
      answer,
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
