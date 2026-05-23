import { NextResponse } from "next/server";
import { generateBatchNewsInsights, generateText, getAIProvider, isAIQuotaError } from "@/lib/ai";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { batchNewsInsightPrompt, dailyBriefingPrompt } from "@/lib/prompts";
import { getKstDayRange } from "@/lib/date";
import { isFreshPublishedAt } from "@/lib/newsFreshness";
import { getDisplayTitle } from "@/lib/newsDisplay";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getTrustedSourceScore } from "@/lib/trustedSources";
import type { EducationNews } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function generateDailyBriefing(news: EducationNews[]) {
  return generateText(dailyBriefingPrompt(news), {
    temperature: 0.3,
  });
}

function fallbackDailyBriefing(news: EducationNews[], date: string) {
  const lines = news.slice(0, 10).map((item, index) =>
    [
      `### ${index + 1}. ${getDisplayTitle(item)}`,
      `- 출처: ${item.source}`,
      `- 카테고리: ${item.category ?? "기타"}`,
      `- 사실 요약: ${item.summary ?? "AI 요약이 아직 생성되지 않았습니다."}`,
      `- 교사 관점: ${item.teacher_insight ?? "교사 관점 통찰이 아직 생성되지 않았습니다."}`,
      `- 학교 적용: ${item.school_action ?? "학교 적용 아이디어가 아직 생성되지 않았습니다."}`,
      `- 원문: ${item.url}`,
    ].join("\n"),
  );

  return [
    `# ${date} 교육 뉴스 브리핑`,
    "",
    "AI 일일 브리핑 생성 요청이 일시적으로 제한되어, 저장된 뉴스 분석 결과를 바탕으로 임시 브리핑을 구성했습니다.",
    "세부 내용은 원문 링크로 확인해주세요.",
    "",
    ...lines,
  ].join("\n\n");
}

function needsTranslatedTitle(item: EducationNews) {
  return !item.translated_title && !/[가-힣]/.test(item.title);
}

function isMissingTranslatedTitleColumn(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    /translated_title|column/i.test(error.message)
  );
}

function sortForAnalysis(a: EducationNews, b: EducationNews) {
  const trustedDiff = getTrustedSourceScore(b) - getTrustedSourceScore(a);

  if (trustedDiff !== 0) {
    return trustedDiff;
  }

  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

async function updateNewsInsight(supabase: ReturnType<typeof getSupabaseAdmin>, item: EducationNews, update: Partial<EducationNews>) {
  const { error } = await supabase.from("education_news").update(update).eq("id", item.id);

  if (!error) {
    return null;
  }

  if ("translated_title" in update && isMissingTranslatedTitleColumn(error)) {
    const { translated_title: _translatedTitle, ...fallbackUpdate } = update;
    const { error: fallbackError } = await supabase.from("education_news").update(fallbackUpdate).eq("id", item.id);

    return fallbackError;
  }

  return error;
}

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = getSupabaseAdmin();
  const { date, start, end } = getKstDayRange();

  const [publishedResult, collectedResult] = await Promise.all([
    supabase
      .from("education_news")
      .select("*")
      .gte("published_at", start)
      .lt("published_at", end)
      .order("published_at", { ascending: false })
      .limit(120),
    supabase
      .from("education_news")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(120),
  ]);
  const error = publishedResult.error ?? collectedResult.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newsMap = new Map<string, EducationNews>();

  for (const item of [
    ...((publishedResult.data ?? []) as EducationNews[]),
    ...((collectedResult.data ?? []) as EducationNews[]),
  ]) {
    if (isFreshPublishedAt(item.published_at)) {
      newsMap.set(item.id, item);
    }
  }

  const news = Array.from(newsMap.values()).sort(sortForAnalysis).slice(0, 40);
  const processed: EducationNews[] = [];
  const errors: Array<{ id: string; title: string; message: string }> = [];
  const unanalyzed = news.filter(
    (item) => !(item.summary && item.teacher_insight && item.school_action && item.importance) || needsTranslatedTitle(item),
  );

  for (const item of news) {
    if (item.summary && item.teacher_insight && item.school_action && item.importance) {
      processed.push(item);
    }
  }

  for (let index = 0; index < unanalyzed.length; index += 10) {
    const chunk = unanalyzed.slice(index, index + 10);
    try {
      const insights = await generateBatchNewsInsights(batchNewsInsightPrompt(chunk));
      const insightMap = new Map(insights.map((insight) => [insight.id, insight]));

      for (const item of chunk) {
        const insight = insightMap.get(item.id);

        if (!insight) {
          errors.push({
            id: item.id,
            title: item.title,
            message: "AI response did not include this item",
          });
          continue;
        }

        const { id: _id, ...update } = insight;
        const updateError = await updateNewsInsight(supabase, item, update);

        if (updateError) {
          errors.push({ id: item.id, title: item.title, message: updateError.message });
        } else {
          processed.push({ ...item, ...update });
        }
      }
    } catch (error) {
      errors.push({
        id: chunk.map((item) => item.id).join(","),
        title: `${chunk.length}개 뉴스 배치 분석`,
        message: error instanceof Error ? error.message : "Unknown insight error",
      });

      if (isAIQuotaError(error)) {
        break;
      }
    }
  }

  let briefingContent = "";
  let briefingId: string | null = null;
  let briefingErrorMessage: string | null = null;

  if (processed.length > 0) {
    try {
      briefingContent = await generateDailyBriefing(processed);
    } catch (error) {
      briefingErrorMessage = error instanceof Error ? error.message : "Unknown briefing error";
      errors.push({
        id: "daily_briefing",
        title: `${date} 교육 뉴스 브리핑`,
        message: briefingErrorMessage,
      });
      briefingContent = fallbackDailyBriefing(processed, date);
    }

    try {
      const { data: briefing, error: briefingError } = await supabase
        .from("daily_briefings")
        .upsert(
          {
            briefing_date: date,
            title: `${date} 교육 뉴스 브리핑`,
            content: briefingContent,
          },
          { onConflict: "briefing_date" },
        )
        .select("id")
        .single();

      if (briefingError) {
        throw briefingError;
      }

      briefingId = briefing.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown briefing save error";
      errors.push({
        id: "daily_briefing_save",
        title: `${date} 교육 뉴스 브리핑 저장`,
        message,
      });
    }
  }

  const ok = Boolean(briefingId);
  const status = ok ? 200 : 500;

  return NextResponse.json(
    {
      ok,
      date,
      provider: getAIProvider(),
      found: news.length,
      processed: processed.length,
      briefingId,
      errors,
      ...(briefingErrorMessage ? { error: briefingErrorMessage } : {}),
    },
    { status },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
