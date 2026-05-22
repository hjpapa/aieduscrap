import { NextResponse } from "next/server";

export function rejectUnauthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
