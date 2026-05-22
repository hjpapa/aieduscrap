import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function callInternalRoute(request: Request, pathname: string) {
  const url = new URL(pathname, request.url);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });
  const body = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

export async function GET(request: Request) {
  const unauthorized = rejectUnauthorizedCron(request);

  if (unauthorized) {
    return unauthorized;
  }

  const collectNews = await callInternalRoute(request, "/api/collect-news");

  if (!collectNews.ok) {
    return NextResponse.json(
      {
        ok: false,
        step: "collect-news",
        collectNews,
      },
      { status: 500 },
    );
  }

  const generateBriefing = await callInternalRoute(request, "/api/generate-briefing");

  return NextResponse.json(
    {
      ok: collectNews.ok && generateBriefing.ok,
      collectNews,
      generateBriefing,
    },
    { status: generateBriefing.ok ? 200 : 500 },
  );
}
