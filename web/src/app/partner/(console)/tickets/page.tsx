import { getDistributorSession } from "@/lib/platform-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupportTicket } from "@/app/actions/platform-admin";
import { ONE_TIME_FEES } from "@/lib/pricing-catalog";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PartnerTicketsPage() {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");

  let tickets: Array<{ id: string; subject: string; status: string; hours_logged: number }> =
    [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("support_tickets")
      .select("id, subject, status, hours_logged")
      .eq("distributor_id", session.distributorId)
      .order("created_at", { ascending: false })
      .limit(50);
    tickets = (data as typeof tickets) ?? [];
  } catch {
    tickets = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Fair use {ONE_TIME_FEES.fairUseHoursMo}h/mo then{" "}
          {ONE_TIME_FEES.billableSupportHourBtn} BTN/h.
        </p>
      </div>
      <form action={createSupportTicket} className="max-w-lg space-y-2 rounded-xl border p-4">
        <input name="subject" required placeholder="Subject" className="w-full rounded-md border px-3 py-2 text-sm" />
        <textarea name="body" required rows={3} className="w-full rounded-md border px-3 py-2 text-sm" />
        <label className="flex gap-2 text-xs">
          <input type="checkbox" name="billable_ack" value="1" />
          Acknowledge billable if over fair use
        </label>
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Open ticket
        </button>
      </form>
      <ul className="space-y-2 text-sm">
        {tickets.map((t) => (
          <li key={t.id} className="rounded-lg border px-3 py-2">
            {t.subject} · {t.status} · {t.hours_logged}h
          </li>
        ))}
      </ul>
    </div>
  );
}
