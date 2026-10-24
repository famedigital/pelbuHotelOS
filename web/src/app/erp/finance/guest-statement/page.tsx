import { PartyStatementSheet } from "@/components/erp/finance/PartyStatementSheet";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadGuestStatement } from "@/lib/finance/party-statement";
import { thimphuToday } from "@/lib/erp-lists";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export default async function GuestStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; from?: string; to?: string; q?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const today = thimphuToday();
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : monthStart(today);
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const q = (sp.q ?? "").trim();
  const { data: stays } = await admin
    .from("bookings")
    .select("id, contact_name, confirmation_code, check_in")
    .eq("property_id", propertyId)
    .ilike("contact_name", `%${q}%`)
    .order("check_in", { ascending: false })
    .limit(30);
  const bookingId = sp.booking || (stays?.[0]?.id as string | undefined) || "";
  const statement = bookingId
    ? await loadGuestStatement(admin, propertyId, bookingId, from, to)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5" action="/erp/finance/guest-statement">
        <h1 className="text-sm font-semibold">Guest statement</h1>
        <input name="q" defaultValue={q} placeholder="Guest" aria-label="Guest" className="h-8 rounded-md border px-2 text-sm" />
        <input type="date" name="from" defaultValue={from} aria-label="From" className="h-8 rounded-md border px-2 text-sm" />
        <input type="date" name="to" defaultValue={to} aria-label="To" className="h-8 rounded-md border px-2 text-sm" />
        <select name="booking" defaultValue={bookingId} aria-label="Stay" className="h-8 max-w-xs rounded-md border px-2 text-sm">
          {(stays ?? []).map((stay) => (
            <option key={stay.id as string} value={stay.id as string}>
              {stay.contact_name as string} · {String(stay.check_in).slice(0, 10)}
            </option>
          ))}
        </select>
        <button type="submit" className="h-8 rounded-md border px-2 text-sm">Show</button>
        {bookingId ? (
          <a className="text-sm text-sky-800" href={`/erp/finance/guest-statement/print?booking=${bookingId}&from=${from}&to=${to}`}>
            Print
          </a>
        ) : null}
      </form>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {statement ? (
          <PartyStatementSheet hotel={property?.name ?? "Hotel"} statement={statement} />
        ) : (
          <p className="text-sm text-muted-foreground">No stay matches that name.</p>
        )}
      </div>
    </div>
  );
}
