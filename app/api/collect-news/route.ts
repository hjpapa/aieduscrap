import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { collectEducationNews } from "@/lib/rss";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const batchSize = 80;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

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
  const existingUrls = new Set<string>();

  for (const urls of chunk(
    items.map((item) => item.url),
    batchSize,
  )) {
    const { data, error } = await supabase.from("education_news").select("url").in("url", urls);

    if (error) {
      insertErrors.push({ url: urls.join(","), message: error.message });
      continue;
    }

    for (const row of data ?? []) {
      if (typeof row.url === "string") {
        existingUrls.add(row.url);
      }
    }
  }

  const itemsToInsert = items.filter((item) => {
    if (existingUrls.has(item.url)) {
      skipped += 1;
      return false;
    }

    return true;
  });

  for (const itemChunk of chunk(itemsToInsert, batchSize)) {
    const { error } = await supabase.from("education_news").insert(itemChunk);

    if (!error) {
      inserted += itemChunk.length;
      continue;
    }

    for (const item of itemChunk) {
      try {
        const { error: itemError } = await supabase.from("education_news").insert(item);

        if (itemError?.code === "23505") {
          skipped += 1;
        } else if (itemError) {
          insertErrors.push({ url: item.url, message: itemError.message });
        } else {
          inserted += 1;
        }
      } catch (caught) {
        insertErrors.push({
          url: item.url,
          message: caught instanceof Error ? caught.message : "Unknown insert error",
        });
      }
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
