import { NextResponse } from "next/server";
import { todayInTimezone } from "@/lib/erp-lists";
import { isPastNightAuditCloseTime } from "@/lib/night-audit/close-time";
import { executeNightAudit } from "@/lib/night-audit/run";
import { captureServerError } from "@/lib/observability";
import { listProperties } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled night audit for every property (timezone-local business date).
 * Requires Authorization: Bearer CRON_SECRET in production.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required in production." },
      { status: 503 },
    );
  }
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createSupabaseAdminClient();
  const properties = await listProperties(admin);
  const results: Array<Record<string, unknown>> = [];

  for (const p of properties) {
    const businessDate = todayInTimezone(p.timezone);
    try {
      if (
        !isPastNightAuditCloseTime({
          timeZone: p.timezone,
          closeTime: p.night_audit_close_time ?? "00:00",
        })
      ) {
        results.push({
          property: p.slug,
          businessDate,
          skipped: true,
          reason: "before_close_time",
          closeTime: p.night_audit_close_time ?? "00:00",
        });
        continue;
      }

      const { data: existing } = await admin
        .from("night_audits")
        .select("id")
        .eq("property_id", p.id)
        .eq("business_date", businessDate)
        .maybeSingle();
      if (existing) {
        results.push({
          property: p.slug,
          businessDate,
          skipped: true,
          reason: "already_run",
        });
        continue;
      }

      const r = await executeNightAudit(admin, p.id, businessDate, {
        runBy: "cron",
      });
      results.push({
        property: p.slug,
        businessDate: r.businessDate,
        auditId: r.auditId,
        posted: r.posted,
        skippedNights: r.skipped,
        roomsOccupied: r.roomsOccupied,
        blockers: r.blockers,
        forceClose: r.forceClose,
        /** Default cron completes with blockers logged; STRICT env fails closed. */
        policy:
          process.env.NIGHT_AUDIT_CRON_STRICT === "1"
            ? "strict_blockers"
            : "complete_with_blockers_logged",
      });
    } catch (e) {
      await captureServerError(e, {
        route: "cron/night-audit",
        property: p.slug,
        businessDate,
      });
      results.push({
        property: p.slug,
        businessDate,
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: Request) {
  return GET(request);
}
