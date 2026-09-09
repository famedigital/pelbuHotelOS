import { NextResponse } from "next/server";
import { expireHeldBookings } from "@/app/actions/erp-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Expire past-due holds. Call from Vercel cron or desk.
 * Also touches the DB so Supabase Free does not auto-pause after 7d inactivity
 * (folded keep-alive — no extra cron on Hobby).
 * Optional header: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { expired } = await expireHeldBookings();

  // Cheap heartbeat: one indexed select. Counts as Free-tier DB activity.
  let keepAlive = false;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("properties").select("id").limit(1);
    keepAlive = !error;
  } catch {
    keepAlive = false;
  }

  return NextResponse.json({ ok: true, expired, keepAlive });
}

export async function POST(request: Request) {
  return GET(request);
}
