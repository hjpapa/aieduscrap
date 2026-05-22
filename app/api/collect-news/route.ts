import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { collectEducationNews } from "@/lib/rss";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request);

  if (unauthorized) {
    return unauthorized;
  }

  const supabase = getSupabaseAdmin();
  const { items, errors } = await collectEducationNews();
  let inserted = 0;
  let skipped = 0;
  const insertErrors: Array<{ url: string; message: string }> = [];

  for (const item of items) {
    try {
      const { error } = await supabase.from("education_news").insert(item);

      if (error?.code === "23505") {
        skipped += 1;
      } else if (error) {
        insertErrors.push({ url: item.url, message: error.message });
      } else {
        inserted += 1;
      }
    } catch (error) {
      insertErrors.push({
        url: item.url,
        message: error instanceof Error ? error.message : "Unknown insert error",
      });
    }
  }

  return NextResponse.json({
    collected: items.length,
    inserted,
    skipped,
    feedErrors: errors,
    insertErrors,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
