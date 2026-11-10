import { z } from "zod";
import { executeNightAudit, todayInTimezone } from "@hotel-os/core";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";

/**
 * Night audit for Hotel OS v2 — runs the SAME close-of-day as Innora
 * (`@hotel-os/core` `executeNightAudit`): occupancy snapshot, room nights
 * posted through `postFolioCharge` (period lock + GL journal + round-off),
 * no-shows, close-day blockers, `night_audits` row, audit event, and the
 * `properties.current_business_date` roll. The hotel backup pack (XLSX +
 * storage + email) is built by Innora's cron/desk run; v2 reports that step
 * as skipped rather than pretending it ran.
 */

/** Same roles Innora allows for folio / finance / night audit (MONEY_ROLES). */
const NIGHT_AUDIT_ROLES = new Set(["owner", "gm", "front_desk", "cashier"]);

export class NightAuditForbiddenError extends Error {
  readonly statusCode = 403;
  constructor() {
    super("Night audit needs an owner, GM, front desk or cashier login.");
  }
}

export async function getNightAuditPreview(ctx: AdapterCtx) {
  const pid = ctx.jwt.propertyId;

  const { data: prop, error: pErr } = await ctx.admin
    .from("properties")
    .select("current_business_date, night_audit_close_time, timezone")
    .eq("id", pid)
    .maybeSingle();
  if (pErr) throw pErr;
  const businessDate =
    (prop?.current_business_date as string | null)?.slice(0, 10) ??
    todayInTimezone(prop?.timezone as string | null);

  const head = { count: "exact" as const, head: true };
  const [inHouse, arrivals, departures, overdue, dirty, openFolios, inHouseList, lastRun] =
    await Promise.all([
      ctx.admin.from("bookings").select("id", head).eq("property_id", pid).eq("status", "checked_in"),
      ctx.admin
        .from("bookings")
        .select("id", head)
        .eq("property_id", pid)
        .eq("check_in", businessDate)
        .eq("status", "confirmed"),
      ctx.admin
        .from("bookings")
        .select("id", head)
        .eq("property_id", pid)
        .eq("check_out", businessDate)
        .in("status", ["confirmed", "checked_in"]),
      ctx.admin
        .from("bookings")
        .select("id", head)
        .eq("property_id", pid)
        .eq("status", "checked_in")
        .lte("check_out", businessDate),
      ctx.admin.from("room_units").select("id", head).eq("property_id", pid).eq("hk_status", "dirty"),
      ctx.admin.from("folios").select("id", head).eq("property_id", pid).eq("status", "open"),
      ctx.admin
        .from("bookings")
        .select("id, confirmation_code, contact_name, check_out")
        .eq("property_id", pid)
        .eq("status", "checked_in")
        .order("check_out")
        .limit(100),
      ctx.admin
        .from("night_audits")
        .select(
          "id, business_date, status, rooms_occupied, rooms_comp, folio_charges_btn, folio_payments_btn, open_folios, run_by, created_at",
        )
        .eq("property_id", pid)
        .order("business_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  for (const r of [inHouse, arrivals, departures, overdue, dirty, openFolios, inHouseList, lastRun]) {
    if (r.error) throw r.error;
  }

  const blockers: string[] = [];
  if ((dirty.count ?? 0) > 0) blockers.push(`${dirty.count} dirty room(s)`);
  if ((overdue.count ?? 0) > 0)
    blockers.push(`${overdue.count} departure(s) still checked in`);

  const { data: alreadyRun } = await ctx.admin
    .from("night_audits")
    .select("id")
    .eq("property_id", pid)
    .eq("business_date", businessDate)
    .maybeSingle();

  return {
    businessDate,
    closeTime: prop?.night_audit_close_time ?? null,
    inHouseCount: inHouse.count ?? 0,
    arrivalCount: arrivals.count ?? 0,
    departureCount: departures.count ?? 0,
    openFolioCount: openFolios.count ?? 0,
    blockers,
    openStays: inHouseList.data ?? [],
    lastRun: lastRun.data ?? null,
    runAvailable:
      !alreadyRun && NIGHT_AUDIT_ROLES.has(String(ctx.jwt.deskRole ?? "").toLowerCase()),
    runWhere: "POST /v1/night-audit/run",
  };
}

const runSchema = z.object({
  idempotencyKey: z.string().uuid(),
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
  /** Legacy desk: `force` toggles force-close when blockers exist. */
  force: z.boolean().optional(),
  forceClose: z.boolean().optional(),
});

export async function runNightAudit(ctx: AdapterCtx, raw: unknown) {
  if (!NIGHT_AUDIT_ROLES.has(String(ctx.jwt.deskRole ?? "").toLowerCase())) {
    throw new NightAuditForbiddenError();
  }
  const input = runSchema.parse(raw);

  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { data: prop, error: pErr } = await ctx.admin
    .from("properties")
    .select("current_business_date, timezone")
    .eq("id", ctx.jwt.propertyId)
    .maybeSingle();
  if (pErr) throw pErr;

  // Open business date first (rolled by each completed audit), else property today.
  const businessDate =
    input.businessDate ??
    ((prop?.current_business_date as string | null)?.slice(0, 10) ??
      todayInTimezone(prop?.timezone as string | null));

  const forceClose = Boolean(input.forceClose ?? input.force);

  const result = await executeNightAudit(
    ctx.admin,
    ctx.jwt.propertyId,
    businessDate,
    {
      runBy: "desk",
      notes: input.notes ?? null,
      forceClose,
      // No deliverBackup: the XLSX continuity pack + email is Innora-only;
      // core records the backup step as "skipped" on this run.
    },
  );

  const payload = {
    ok: true,
    auditId: result.auditId,
    businessDate: result.businessDate,
    posted: result.posted,
    skipped: result.skipped,
    roomsOccupied: result.roomsOccupied,
    roomsComp: result.roomsComp,
    openFolios: result.openFolios,
    folioChargesBtn: result.folioChargesBtn,
    folioPaymentsBtn: result.folioPaymentsBtn,
    roomNightErrors: result.roomNightErrors,
    blockers: result.blockers,
    forceClose: result.forceClose,
    pipeline: result.pipeline,
    hotelBackup: result.hotelBackup ?? null,
  };

  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "night_audit_run",
    payload,
  );

  return payload;
}
