import { processStaffNotificationOutbox } from "@/lib/staff-notify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Drains pending/failed staff notifications.
 * Triggered by Vercel Cron (Authorization: Bearer $CRON_SECRET) or manually
 * with the same header. Free-first: only sends in-app, Web Push and email.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const { processed } = await processStaffNotificationOutbox(100);
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "drain failed" },
      { status: 500 },
    );
  }
}
