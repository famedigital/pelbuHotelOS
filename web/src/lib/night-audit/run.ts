import "server-only";
import { writeAuditEvent } from "@/lib/audit";
import { postRoomNightsForDate } from "@/lib/folio/room-night";
import { deliverHotelBackupPack } from "@/lib/night-audit/deliver-hotel-backup";
import {
  applyPipelineStep,
  initialNightAuditPipeline,
  NIGHT_AUDIT_STEP_LABELS,
  type NightAuditPipelineStep,
  type NightAuditStepEvent,
  type NightAuditStepId,
} from "@/lib/night-audit/steps";
import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type {
  NightAuditPipelineStep,
  NightAuditStepEvent,
  NightAuditStepId,
  NightAuditStepStatus,
} from "@/lib/night-audit/steps";
export {
  initialNightAuditPipeline,
  NIGHT_AUDIT_STEP_IDS,
  NIGHT_AUDIT_STEP_LABELS,
} from "@/lib/night-audit/steps";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type NightAuditRunBy = "desk" | "cron";

export type ExecuteNightAuditResult = {
  ok: true;
  auditId: string;
  businessDate: string;
  posted: number;
  skipped: number;
  roomsOccupied: number;
  roomsComp: number;
  openFolios: number;
  folioChargesBtn: number;
  folioPaymentsBtn: number;
  roomNightErrors: string[];
  blockers: string[];
  forceClose: boolean;
  pipeline: NightAuditPipelineStep[];
  hotelBackup?: {
    ok: boolean;
    emailed: boolean;
    storagePath?: string;
    filename?: string;
    error?: string;
  };
};

export type ExecuteNightAuditOptions = {
  runBy: NightAuditRunBy;
  notes?: string | null;
  forceClose?: boolean;
  onStep?: (event: NightAuditStepEvent) => void | Promise<void>;
};

/**
 * Desk-free night audit: occupancy snapshot + room-night posting + night_audits row.
 * Idempotent per (property_id, business_date).
 */
export async function executeNightAudit(
  admin: Admin,
  propertyId: string,
  businessDate: string,
  opts: ExecuteNightAuditOptions,
): Promise<ExecuteNightAuditResult> {
  const date = businessDate.slice(0, 10);
  let pipeline = initialNightAuditPipeline();
  const emit = async (
    id: NightAuditStepId,
    status: NightAuditStepEvent["status"],
    detail?: string,
  ) => {
    const event: NightAuditStepEvent = {
      id,
      label: NIGHT_AUDIT_STEP_LABELS[id],
      status,
      detail,
    };
    pipeline = applyPipelineStep(pipeline, event);
    await opts.onStep?.(event);
  };

  await emit("guard", "running");
  const { data: existing } = await admin
    .from("night_audits")
    .select("id")
    .eq("property_id", propertyId)
    .eq("business_date", date)
    .maybeSingle();
  if (existing) {
    const msg = `Night audit already run for ${date}.`;
    await emit("guard", "failed", msg);
    throw new Error(msg);
  }
  await emit("guard", "done", `Business date ${date} is open`);

  const nextDay = (() => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  await emit("occupancy", "running");
  const [{ data: inHouse }, { data: openFolios }, { data: dayLines }] =
    await Promise.all([
      admin
        .from("bookings")
        .select("id, booking_rooms(qty, inventory_kind)")
        .eq("property_id", propertyId)
        .in("status", ["confirmed", "checked_in"])
        .lte("check_in", date)
        .gt("check_out", date),
      admin
        .from("folios")
        .select("id")
        .eq("property_id", propertyId)
        .eq("status", "open"),
      admin
        .from("folios")
        .select(
          "id, folio_lines(id, source_type, total_btn, amount_btn, status, created_at, business_date, is_comp)",
        )
        .eq("property_id", propertyId)
        .limit(400),
    ]);

  let roomsOccupied = 0;
  let roomsComp = 0;
  for (const b of inHouse ?? []) {
    for (const line of (b.booking_rooms as
      | { qty: number; inventory_kind: string }[]
      | null) ?? []) {
      if (line.inventory_kind === "sellable_guest") {
        roomsOccupied += Number(line.qty);
      } else if (
        line.inventory_kind === "guide_comp" ||
        line.inventory_kind === "driver_comp"
      ) {
        roomsComp += Number(line.qty);
      }
    }
  }
  await emit(
    "occupancy",
    "done",
    `${roomsOccupied} sellable · ${roomsComp} comp · ${(inHouse ?? []).length} booking(s)`,
  );

  await emit("day_money", "running");
  let charges = 0;
  let payments = 0;
  for (const f of dayLines ?? []) {
    for (const line of (f.folio_lines as
      | {
          source_type: string;
          total_btn: number;
          status: string;
          created_at: string;
        }[]
      | null) ?? []) {
      if (line.status !== "posted") continue;
      const day = String(line.created_at).slice(0, 10);
      if (day !== date) continue;
      const total = Number(line.total_btn);
      if (line.source_type === "payment" || line.source_type === "deposit") {
        payments += Math.abs(total);
      } else {
        charges += total;
      }
    }
  }
  await emit(
    "day_money",
    "done",
    `Charges Nu ${roundBtn(charges)} · payments Nu ${roundBtn(payments)} · open folios ${(openFolios ?? []).length}`,
  );

  await emit("room_nights", "running");
  const roomNightResult = await postRoomNightsForDate(admin, propertyId, date);
  await emit(
    "room_nights",
    "done",
    roomNightResult.errors.length > 0
      ? `${roomNightResult.posted} posted · ${roomNightResult.skipped} skipped · ${roomNightResult.errors.length} error(s)`
      : `${roomNightResult.posted} posted · ${roomNightResult.skipped} skipped`,
  );

  await emit("no_shows", "running");
  const { data: noShowCandidates } = await admin
    .from("bookings")
    .select("id, contact_name")
    .eq("property_id", propertyId)
    .eq("status", "confirmed")
    .eq("check_in", date);
  let noShows = 0;
  for (const b of noShowCandidates ?? []) {
    const { error: nsErr } = await admin
      .from("bookings")
      .update({ status: "no_show" })
      .eq("id", b.id)
      .eq("status", "confirmed");
    if (!nsErr) noShows += 1;
  }
  await emit(
    "no_shows",
    "done",
    noShows > 0 ? `${noShows} marked no-show` : "None",
  );

  await emit("blockers", "running");
  const { count: dirtyCount } = await admin
    .from("room_units")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("hk_status", "dirty");

  const openBalanceFolios: string[] = [];
  for (const f of openFolios ?? []) {
    const { data: lines } = await admin
      .from("folio_lines")
      .select("total_btn, status, reverses_line_id")
      .eq("folio_id", f.id);
    let bal = 0;
    for (const line of lines ?? []) {
      if ((line.status as string) !== "posted") continue;
      if (line.reverses_line_id) continue;
      bal += Number(line.total_btn);
    }
    if (Math.abs(bal) > 0.01) openBalanceFolios.push(f.id as string);
  }

  const blockers: string[] = [];
  if ((dirtyCount ?? 0) > 0) {
    blockers.push(`${dirtyCount} dirty room(s)`);
  }
  if (openBalanceFolios.length > 0) {
    blockers.push(`${openBalanceFolios.length} open folio(s) with balance`);
  }
  if (roomNightResult.errors.length > 0) {
    blockers.push(`${roomNightResult.errors.length} room-night error(s)`);
  }

  const { count: overdueDepartures } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("check_out", date)
    .eq("status", "checked_in");
  if ((overdueDepartures ?? 0) > 0) {
    blockers.push(
      `${overdueDepartures} departure(s) still checked in (not checked out)`,
    );
  }

  const rateVariance: { lineId: string; amount: number; note: string }[] = [];
  for (const f of dayLines ?? []) {
    for (const line of (f.folio_lines as
      | {
          id: string;
          source_type: string;
          total_btn: number;
          amount_btn?: number;
          status: string;
          created_at: string;
          business_date?: string | null;
        }[]
      | null) ?? []) {
      if (line.status !== "posted" || line.source_type !== "room") continue;
      const biz =
        (line.business_date && String(line.business_date).slice(0, 10)) ||
        String(line.created_at).slice(0, 10);
      if (biz !== date) continue;
      const amt = Number(line.amount_btn ?? line.total_btn);
      if (!Number.isFinite(amt) || amt <= 0) {
        rateVariance.push({
          lineId: line.id,
          amount: amt,
          note: "Room-night amount missing or ≤ 0",
        });
      }
    }
  }
  if (rateVariance.length > 0) {
    blockers.push(`${rateVariance.length} room-night rate variance row(s)`);
  }

  const forceClose =
    opts.notes?.toLowerCase().includes("force close") ||
    Boolean(opts.forceClose);

  const cronStrict =
    opts.runBy === "cron" && process.env.NIGHT_AUDIT_CRON_STRICT === "1";

  if (
    blockers.length > 0 &&
    !forceClose &&
    (opts.runBy === "desk" || cronStrict)
  ) {
    const msg = `Night audit blocked: ${blockers.join("; ")}.${
      opts.runBy === "desk"
        ? ' Add note "force close" to override with audit.'
        : " Clear blockers or unset NIGHT_AUDIT_CRON_STRICT."
    }`;
    await emit("blockers", "failed", msg);
    throw new Error(msg);
  }

  if (blockers.length > 0 && forceClose) {
    await emit("blockers", "done", `Force close — ${blockers.join("; ")}`);
  } else if (blockers.length > 0) {
    await emit(
      "blockers",
      "done",
      `Logged (cron continues): ${blockers.join("; ")}`,
    );
  } else {
    await emit("blockers", "done", "All clear");
  }

  if (roomNightResult.errors.length > 0 && !forceClose) {
    const msg = `Room-night posting failed for ${roomNightResult.errors.length} room(s): ${roomNightResult.errors.slice(0, 3).join(" ")}`;
    await emit("save", "failed", msg);
    throw new Error(msg);
  }

  const summaryBase = {
    business_date: date,
    next_day: nextDay,
    in_house_bookings: (inHouse ?? []).length,
    room_nights_posted: roomNightResult.posted,
    room_nights_skipped: roomNightResult.skipped,
    room_night_errors: roomNightResult.errors,
    no_shows: noShows,
    dirty_rooms: dirtyCount ?? 0,
    open_balance_folios: openBalanceFolios.length,
    overdue_departures: overdueDepartures ?? 0,
    rate_variance: rateVariance,
    blockers,
    force_close: forceClose,
    pipeline: pipeline.map((s) => ({ ...s })),
  };

  await emit("save", "running");
  const { data: audit, error } = await admin
    .from("night_audits")
    .insert({
      property_id: propertyId,
      business_date: date,
      status: "completed",
      rooms_occupied: roomsOccupied,
      rooms_comp: roomsComp,
      folio_charges_btn: roundBtn(charges),
      folio_payments_btn: roundBtn(payments),
      open_folios: (openFolios ?? []).length,
      summary: summaryBase,
      run_by: opts.runBy,
      notes: opts.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !audit) {
    console.error("night_audits insert failed", error);
    const msg = "Could not save night audit.";
    await emit("save", "failed", msg);
    throw new Error(msg);
  }
  await emit("save", "done", `Audit ${String(audit.id).slice(0, 8)}…`);

  await writeAuditEvent(admin, {
    propertyId,
    action: "night_audit.run",
    entityType: "night_audits",
    entityId: audit.id as string,
    summary: `Night audit ${date} · occ ${roomsOccupied} + comp ${roomsComp}`,
    meta: summaryBase,
  });

  await emit("backup", "running");
  const hotelBackup = await deliverHotelBackupPack(admin, propertyId, date, {
    auditId: audit.id as string,
    roomsOccupied,
    roomsComp,
    posted: roomNightResult.posted,
    skipped: roomNightResult.skipped,
    openFolios: (openFolios ?? []).length,
    folioChargesBtn: roundBtn(charges),
    folioPaymentsBtn: roundBtn(payments),
    noShows,
    blockers,
    runBy: opts.runBy,
    notes: opts.notes ?? null,
    forceClose,
  });

  const hotel_backup = {
    ok: hotelBackup.ok,
    emailed: hotelBackup.emailed,
    storage_path: hotelBackup.storagePath ?? null,
    filename: hotelBackup.filename ?? null,
    error: hotelBackup.error ?? null,
  };

  if (hotelBackup.ok) {
    await emit(
      "backup",
      "done",
      hotelBackup.emailed
        ? "Emailed + stored"
        : hotelBackup.filename
          ? `Stored ${hotelBackup.filename}`
          : "Stored",
    );
  } else {
    await emit(
      "backup",
      "done",
      hotelBackup.error
        ? `Pack failed (audit saved): ${hotelBackup.error}`
        : "Pack failed (audit saved)",
    );
  }

  const pipelineFinal = pipeline.map((s) => ({ ...s }));
  const summary = {
    ...summaryBase,
    pipeline: pipelineFinal,
    hotel_backup,
    continuity_pack: hotel_backup,
  };
  await admin
    .from("night_audits")
    .update({ summary })
    .eq("id", audit.id as string);

  return {
    ok: true,
    auditId: audit.id as string,
    businessDate: date,
    posted: roomNightResult.posted,
    skipped: roomNightResult.skipped,
    roomsOccupied,
    roomsComp,
    openFolios: (openFolios ?? []).length,
    folioChargesBtn: roundBtn(charges),
    folioPaymentsBtn: roundBtn(payments),
    roomNightErrors: roomNightResult.errors,
    blockers,
    forceClose,
    pipeline: pipelineFinal,
    hotelBackup: {
      ok: hotelBackup.ok,
      emailed: hotelBackup.emailed,
      storagePath: hotelBackup.storagePath,
      filename: hotelBackup.filename,
      error: hotelBackup.error,
    },
  };
}
