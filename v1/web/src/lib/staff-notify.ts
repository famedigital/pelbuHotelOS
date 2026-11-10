/**
 * Free-first staff notification fan-out.
 *
 * Delivery channels, in priority of "always free":
 *  1. in_app   — the recipient/outbox rows already power the staff inbox; we
 *                only mark them sent.
 *  2. web_push — standards-based Web Push (VAPID). No per-message vendor fee.
 *                Skipped (left pending->skipped) when VAPID keys are absent.
 *  3. email    — Resend, within its free tier. Skipped when no API key.
 *
 * WhatsApp is intentionally NOT auto-sent here: the CallMeBot setup targets a
 * single desk number and official WhatsApp Business messaging is not free.
 *
 * Failures never throw into the caller; the outbox retries pending/failed rows.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import webpush from "web-push";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type OutboxRow = {
  id: string;
  property_id: string;
  staff_id: string | null;
  announcement_id: string | null;
  channel: "in_app" | "web_push" | "email";
  event_type: string;
  attempts: number;
  payload: Record<string, unknown>;
};

const MAX_ATTEMPTS = 5;

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://pelbusuites.bt";
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

function configureVapid(): boolean {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || `mailto:desk@pelbusuites.bt`,
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  return true;
}

function payloadTitle(row: OutboxRow): string {
  const title = row.payload.title;
  return typeof title === "string" && title.trim() ? title : "Pelbu Suites";
}

function payloadUrl(row: OutboxRow): string {
  const url = row.payload.url;
  return typeof url === "string" && url ? url : "/staff";
}

async function markSent(admin: Admin, id: string): Promise<void> {
  await admin
    .from("hr_notification_outbox")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
}

async function markSkipped(admin: Admin, id: string, reason: string): Promise<void> {
  await admin
    .from("hr_notification_outbox")
    .update({ status: "skipped", last_error: reason })
    .eq("id", id);
}

async function markFailed(
  admin: Admin,
  row: OutboxRow,
  reason: string,
): Promise<void> {
  const attempts = row.attempts + 1;
  await admin
    .from("hr_notification_outbox")
    .update({
      status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      attempts,
      last_error: reason.slice(0, 500),
      available_at: new Date(Date.now() + attempts * 60_000).toISOString(),
    })
    .eq("id", row.id);
}

async function deliverInApp(admin: Admin, row: OutboxRow): Promise<void> {
  if (row.announcement_id && row.staff_id) {
    await admin
      .from("hr_announcement_recipients")
      .update({ delivered_at: new Date().toISOString() })
      .eq("announcement_id", row.announcement_id)
      .eq("staff_id", row.staff_id)
      .is("delivered_at", null);
  }
  await markSent(admin, row.id);
}

async function deliverWebPush(admin: Admin, row: OutboxRow): Promise<void> {
  if (!configureVapid()) {
    await markSkipped(admin, row.id, "VAPID keys not configured");
    return;
  }
  if (!row.staff_id) {
    await markSkipped(admin, row.id, "No staff for push");
    return;
  }

  const { data: subs } = await admin
    .from("hr_push_subscriptions")
    .select("id, endpoint, p256dh, auth_secret")
    .eq("staff_id", row.staff_id)
    .eq("is_active", true);

  if (!subs?.length) {
    await markSkipped(admin, row.id, "No active push subscriptions");
    return;
  }

  const body = JSON.stringify({
    title: payloadTitle(row),
    body:
      typeof row.payload.category === "string"
        ? `New ${row.payload.category} notice`
        : "You have a new staff update",
    url: `${siteUrl()}${payloadUrl(row)}`,
  });

  let anyDelivered = false;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: {
            p256dh: sub.p256dh as string,
            auth: sub.auth_secret as string,
          },
        },
        body,
      );
      anyDelivered = true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin
          .from("hr_push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      }
    }
  }

  if (anyDelivered) {
    await markSent(admin, row.id);
  } else {
    await markFailed(admin, row, "All push endpoints failed");
  }
}

async function deliverEmail(admin: Admin, row: OutboxRow): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = typeof row.payload.email === "string" ? row.payload.email : null;
  if (!apiKey) {
    await markSkipped(admin, row.id, "Resend API key not configured");
    return;
  }
  if (!to) {
    await markSkipped(admin, row.id, "No staff email");
    return;
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>";
  const title = payloadTitle(row);
  const link = `${siteUrl()}${payloadUrl(row)}`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: `[Pelbu Staff] ${title}`,
      text: [
        title,
        "",
        "You have a new update in the Pelbu staff portal.",
        link,
        "",
        "Pelbu Suites",
      ].join("\n"),
    });
    if (error) {
      await markFailed(admin, row, String(error));
      return;
    }
    await markSent(admin, row.id);
  } catch (error) {
    await markFailed(admin, row, error instanceof Error ? error.message : "send failed");
  }
}

/** Drains a batch of pending staff notifications. Safe to call repeatedly. */
export async function processStaffNotificationOutbox(
  limit = 50,
): Promise<{ processed: number }> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("hr_notification_outbox")
    .select(
      "id, property_id, staff_id, announcement_id, channel, event_type, attempts, payload",
    )
    .in("status", ["pending", "failed"])
    .lte("available_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!rows?.length) return { processed: 0 };

  for (const raw of rows) {
    const row = raw as OutboxRow;
    await admin
      .from("hr_notification_outbox")
      .update({ status: "processing" })
      .eq("id", row.id);

    try {
      if (row.channel === "in_app") {
        await deliverInApp(admin, row);
      } else if (row.channel === "web_push") {
        await deliverWebPush(admin, row);
      } else if (row.channel === "email") {
        await deliverEmail(admin, row);
      } else {
        await markSkipped(admin, row.id, `Unknown channel ${row.channel}`);
      }
    } catch (error) {
      await markFailed(
        admin,
        row,
        error instanceof Error ? error.message : "delivery error",
      );
    }
  }

  return { processed: rows.length };
}
