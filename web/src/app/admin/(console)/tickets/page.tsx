import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupportTicket } from "@/app/actions/platform-admin";
import { ONE_TIME_FEES } from "@/lib/pricing-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tickets", robots: { index: false, follow: false } };

export default async function AdminTicketsPage() {
  let tickets: Array<{
    id: string;
    subject: string;
    status: string;
    hours_logged: number;
    created_by_email: string | null;
  }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("support_tickets")
      .select("id, subject, status, hours_logged, created_by_email")
      .order("created_at", { ascending: false })
      .limit(50);
    tickets = (data as typeof tickets) ?? [];
  } catch {
    tickets = [];
  }

  const hoursUsed = tickets.reduce((s, t) => s + Number(t.hours_logged ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support tickets</h1>
        <p className="text-sm text-muted-foreground">
          Fair use ≈ {ONE_TIME_FEES.fairUseHoursMo}h/mo then billable. Logged hours
          (sample sum): {hoursUsed.toFixed(1)}h
        </p>
      </div>

      <form action={createSupportTicket} className="max-w-lg space-y-2 rounded-xl border p-4">
        <input name="subject" required placeholder="Subject" className="w-full rounded-md border px-3 py-2 text-sm" />
        <textarea name="body" required rows={3} placeholder="Details" className="w-full rounded-md border px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="billable_ack" value="1" />
          Acknowledge billable if over fair use ({ONE_TIME_FEES.billableSupportHourBtn} BTN/h)
        </label>
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Open ticket
        </button>
      </form>

      <ul className="space-y-2 text-sm">
        {tickets.map((t) => (
          <li key={t.id} className="rounded-lg border px-3 py-2">
            <span className="font-medium">{t.subject}</span> · {t.status} ·{" "}
            {t.hours_logged}h · {t.created_by_email}
          </li>
        ))}
      </ul>
    </div>
  );
}
