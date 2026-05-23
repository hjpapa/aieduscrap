import { NextResponse } from "next/server";
import { generateText, getAIProvider } from "@/lib/ai";
import { normalizeRoleType } from "@/lib/rolePrompts";
import { getNewsByIds, searchNews } from "@/lib/searchNews";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeOutputType, outputTypeLabels, transformPrompt } from "@/lib/transformPrompts";
import type { EducationNews, NewsReference } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

async function saveOutput({
  outputType,
  roleType,
  newsIds,
  title,
  content,
}: {
  outputType: string;
  roleType: string;
  newsIds: string[];
  title: string;
  content: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("generated_outputs").insert({
      output_type: outputType,
      role_type: roleType,
      news_ids: newsIds,
      title,
      content,
    });

    return !error;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      outputType?: unknown;
      newsIds?: unknown;
      roleType?: unknown;
    };
    const outputType = normalizeOutputType(body.outputType);
    const roleType = normalizeRoleType(body.roleType);
    const newsIds = Array.isArray(body.newsIds)
      ? body.newsIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 12)
      : [];

    const news = newsIds.length > 0 ? await getNewsByIds(newsIds) : await searchNews({ period: "1w", limit: 8 });

    if (news.length === 0) {
      return NextResponse.json(
        {
          error: "변환할 수 있는 저장 뉴스가 없습니다. 뉴스 수집과 브리핑 생성을 먼저 실행해주세요.",
        },
        { status: 404 },
      );
    }

    const content = await generateText(transformPrompt(outputType, roleType, news), {
      temperature: 0.28,
    });
    const title = outputTypeLabels[outputType];
    const references = toReferences(news);
    const saved = await saveOutput({
      outputType,
      roleType,
      newsIds: references.map((item) => item.id),
      title,
      content,
    });

    return NextResponse.json({
      title,
      content,
      references,
      provider: getAIProvider(),
      saved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `산출물을 생성하지 못했습니다. 잠시 후 다시 시도해주세요. (${error.message})`
            : "산출물을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 },
    );
  }
}
