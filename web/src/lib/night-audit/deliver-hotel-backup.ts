import "server-only";

import { Resend } from "resend";
import {
  buildHotelBackupPack,
  HOTEL_BACKUP_BUCKET,
  hotelBackupStoragePath,
  type HotelBackupAuditSummary,
} from "@/lib/night-audit/hotel-backup-pack";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type DeliverHotelBackupResult = {
  ok: boolean;
  storagePath?: string;
  emailed: boolean;
  filename?: string;
  error?: string;
};

function backupEmailRecipients(): string[] {
  const primary = process.env.NOTIFY_DESK_EMAIL?.trim();
  const extra = (process.env.OPS_BACKUP_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set<string>();
  if (primary) set.add(primary);
  for (const e of extra) set.add(e);
  return [...set];
}

async function sendBackupEmail(opts: {
  to: string[];
  subject: string;
  text: string;
  filename: string;
  buffer: Buffer;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  if (opts.to.length === 0) {
    return { ok: false, error: "No NOTIFY_DESK_EMAIL / OPS_BACKUP_EMAIL" };
  }
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: [
      {
        filename: opts.filename,
        content: opts.buffer,
      },
    ],
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Build, upload, and email the hotel backup pack.
 * Never throws — night audit must succeed even if pack delivery fails.
 */
export async function deliverHotelBackupPack(
  admin: Admin,
  propertyId: string,
  businessDate: string,
  auditSummary?: HotelBackupAuditSummary | null,
): Promise<DeliverHotelBackupResult> {
  try {
    const { buffer, filename, propertySlug } = await buildHotelBackupPack(
      admin,
      propertyId,
      businessDate,
      auditSummary,
    );
    const storagePath = hotelBackupStoragePath(propertyId, businessDate);

    const { error: uploadError } = await admin.storage
      .from(HOTEL_BACKUP_BUCKET)
      .upload(storagePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) {
      console.error("hotel backup storage upload failed", uploadError);
    }

    const recipients = backupEmailRecipients();
    const flashLines = [
      `FO flash · ${propertySlug} · business date ${businessDate.slice(0, 10)}`,
      `Occupied rooms: ${auditSummary?.roomsOccupied ?? "—"} · comp: ${auditSummary?.roomsComp ?? "—"}`,
      `Room nights posted: ${auditSummary?.posted ?? "—"} · skipped: ${auditSummary?.skipped ?? "—"}`,
      `Open folios: ${auditSummary?.openFolios ?? "—"}`,
      `Charges Nu ${auditSummary?.folioChargesBtn ?? "—"} · payments Nu ${auditSummary?.folioPaymentsBtn ?? "—"}`,
      `No-shows: ${auditSummary?.noShows ?? 0}`,
      auditSummary?.blockers?.length
        ? `Blockers: ${auditSummary.blockers.join("; ")}`
        : "Blockers: none",
      auditSummary?.forceClose ? "Force-close used." : null,
      `Run by: ${auditSummary?.runBy ?? "—"}`,
      "",
      "Full hotel backup attach (xlsx) — arrivals/departures/in-house sheets inside.",
      "Download again: ERP → Night audit → Download hotel backup.",
    ].filter(Boolean) as string[];

    const mail = await sendBackupEmail({
      to: recipients,
      subject: `[Pelbu] NA pack + FO flash · ${propertySlug} · ${businessDate.slice(0, 10)}`,
      text: [
        ...flashLines,
        "",
        "Confidential — owner/ops only. Save to phone/USB.",
        "pack_version 1 — future clean-state import contract (importer not shipped yet).",
        `Audit id: ${auditSummary?.auditId ?? "—"}`,
      ].join("\n"),
      filename,
      buffer,
    });

    if (!mail.ok) {
      console.error("hotel backup email failed", mail.error);
    }

    return {
      ok: !uploadError,
      storagePath: uploadError ? undefined : storagePath,
      emailed: mail.ok,
      filename,
      error: uploadError?.message ?? (!mail.ok ? mail.error : undefined),
    };
  } catch (err) {
    console.error("deliverHotelBackupPack threw", err);
    return {
      ok: false,
      emailed: false,
      error: err instanceof Error ? err.message : "pack failed",
    };
  }
}
