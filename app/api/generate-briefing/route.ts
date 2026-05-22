import { NextResponse } from "next/server";
import { generateBatchNewsInsights, generateText, getAIProvider, isAIQuotaError } from "@/lib/ai";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { batchNewsInsightPrompt, dailyBriefingPrompt } from "@/lib/prompts";
import { getKstDayRange } from "@/lib/date";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EducationNews } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function generateDailyBriefing(news: EducationNews[]) {
  return generateText(dailyBriefingPrompt(news), {
    temperature: 0.3,
  });
}

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = getSupabaseAdmin();
  const { date, start, end } = getKstDayRange();

  const { data, error } = await supabase
    .from("education_news")
    .select("*")
    .gte("published_at", start)
    .lt("published_at", end)
    .order("published_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const news = (data ?? []) as EducationNews[];
  const processed: EducationNews[] = [];
  const errors: Array<{ id: string; title: string; message: string }> = [];
  const unanalyzed = news.filter((item) => !(item.summary && item.teacher_insight && item.school_action && item.importance));

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
        const { error: updateError } = await supabase.from("education_news").update(update).eq("id", item.id);

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
      briefingErrorMessage = error instanceof Error ? error.message : "Unknown briefing error";
      errors.push({
        id: "daily_briefing",
        title: `${date} 교육 뉴스 브리핑`,
        message: briefingErrorMessage,
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
