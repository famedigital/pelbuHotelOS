import "server-only";

import { Resend } from "resend";
import { MARKETING_EMAIL_BATCH_MAX } from "@/lib/marketing/email-batch-limit";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { MARKETING_EMAIL_BATCH_MAX };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type BroadcastRecipient = {
  contactId: string;
  email: string;
  fullName: string;
};

export type BroadcastResult = {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

function resendFrom(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Simple HTML body from plain text + optional raw HTML fragment. */
export function buildMarketingEmailHtml(args: {
  propertyName: string;
  bodyText: string;
  bodyHtml?: string | null;
  recipientName?: string;
}): string {
  const greeting = args.recipientName
    ? `<p>Hi ${escapeHtml(args.recipientName)},</p>`
    : "";
  const content = args.bodyHtml?.trim()
    ? args.bodyHtml.trim()
    : `<p style="white-space:pre-wrap">${escapeHtml(args.bodyText)}</p>`;
  return `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;color:#1c1917;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#0ea5e9;margin:0 0 16px">${escapeHtml(args.propertyName)}</p>
  ${greeting}
  ${content}
  <p style="margin-top:32px;font-size:12px;color:#78716c">— ${escapeHtml(args.propertyName)}</p>
</body></html>`;
}

export async function sendMarketingBroadcast(
  admin: Admin,
  args: {
    propertyId: string;
    propertyName: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string | null;
    campaignId?: string | null;
    recipients: BroadcastRecipient[];
    createdBy?: string;
  },
): Promise<BroadcastResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Email is not configured (RESEND_API_KEY).");
  }
  if (args.recipients.length === 0) {
    throw new Error("Select at least one contact with an email address.");
  }
  if (args.recipients.length > MARKETING_EMAIL_BATCH_MAX) {
    throw new Error(
      `Batch limit is ${MARKETING_EMAIL_BATCH_MAX} emails per send. Narrow tags or selection.`,
    );
  }

  const resend = new Resend(apiKey);
  const result: BroadcastResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const createdBy = args.createdBy ?? "desk";

  for (const r of args.recipients) {
    const to = r.email.trim().toLowerCase();
    if (!to || !to.includes("@")) {
      result.skipped += 1;
      await admin.from("marketing_email_sends").insert({
        property_id: args.propertyId,
        contact_id: r.contactId,
        campaign_id: args.campaignId ?? null,
        to_email: r.email || "(missing)",
        subject: args.subject,
        body_text: args.bodyText,
        body_html: args.bodyHtml ?? null,
        status: "skipped",
        error: "Invalid or missing email",
        created_by: createdBy,
      });
      continue;
    }

    const html = buildMarketingEmailHtml({
      propertyName: args.propertyName,
      bodyText: args.bodyText,
      bodyHtml: args.bodyHtml,
      recipientName: r.fullName,
    });
    const plain = `Hi ${r.fullName},\n\n${args.bodyText}\n\n— ${args.propertyName}`;

    try {
      const { data, error } = await resend.emails.send({
        from: resendFrom(),
        to: [to],
        subject: args.subject,
        text: plain,
        html,
      });
      if (error) {
        result.failed += 1;
        result.errors.push(`${to}: ${error.message}`);
        await admin.from("marketing_email_sends").insert({
          property_id: args.propertyId,
          contact_id: r.contactId,
          campaign_id: args.campaignId ?? null,
          to_email: to,
          subject: args.subject,
          body_text: args.bodyText,
          body_html: args.bodyHtml ?? null,
          status: "failed",
          error: error.message,
          created_by: createdBy,
        });
        continue;
      }
      result.sent += 1;
      await admin.from("marketing_email_sends").insert({
        property_id: args.propertyId,
        contact_id: r.contactId,
        campaign_id: args.campaignId ?? null,
        to_email: to,
        subject: args.subject,
        body_text: args.bodyText,
        body_html: args.bodyHtml ?? null,
        status: "sent",
        resend_id: data?.id ?? null,
        created_by: createdBy,
      });
      await admin
        .from("marketing_contacts")
        .update({
          last_touched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.contactId)
        .eq("property_id", args.propertyId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      result.failed += 1;
      result.errors.push(`${to}: ${msg}`);
      await admin.from("marketing_email_sends").insert({
        property_id: args.propertyId,
        contact_id: r.contactId,
        campaign_id: args.campaignId ?? null,
        to_email: to,
        subject: args.subject,
        body_text: args.bodyText,
        body_html: args.bodyHtml ?? null,
        status: "failed",
        error: msg,
        created_by: createdBy,
      });
    }
  }

  return result;
}
