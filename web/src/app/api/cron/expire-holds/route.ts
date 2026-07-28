import { NextResponse } from "next/server";
import { expireHeldBookings } from "@/app/actions/erp-holds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Expire past-due holds. Call from Vercel cron or desk.
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
  return NextResponse.json({ ok: true, expired });
}

export async function POST(request: Request) {
  return GET(request);
}
