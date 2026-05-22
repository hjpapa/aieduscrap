import { NextResponse } from "next/server";
import { getKstDayRange } from "@/lib/date";
import { dedupeNewsForDisplay } from "@/lib/dedupe";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EducationNews } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request);

  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") !== "false";
  const supabase = getSupabaseAdmin();
  const { start, end, date } = getKstDayRange();

  const { data, error } = await supabase
    .from("education_news")
    .select("*")
    .gte("published_at", start)
    .lt("published_at", end)
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const news = (data ?? []) as EducationNews[];
  const { kept, removed } = dedupeNewsForDisplay(news);
  const removedIds = removed.map((item) => item.id);

  if (!dryRun && removedIds.length > 0) {
    const { error: deleteError } = await supabase.from("education_news").delete().in("id", removedIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    date,
    dryRun,
    before: news.length,
    kept: kept.length,
    duplicates: removed.length,
    deleted: dryRun ? 0 : removed.length,
    examples: removed.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      url: item.url,
    })),
  });
}
