import {
  DeskListShell,
  DeskSearchForm,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, matchesQuery, requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Guests | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type GuestStay = {
  guestId: string;
  full_name: string;
  nationality: string | null;
  passport_or_cid: string | null;
  sdf_ref: string | null;
  sdf_doc_url: string | null;
  booking_id: string;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  guest_origin: string | null;
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: bookings } = await admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, guest_origin,
       booking_guests(id, full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url)`,
    )
    .eq("property_id", propertyId)
    .order("check_in", { ascending: false })
    .limit(300);

  const stays: GuestStay[] = [];
  for (const b of bookings ?? []) {
    const guests = (b.booking_guests as {
      id: string;
      full_name: string | null;
      nationality: string | null;
      passport_or_cid: string | null;
      sdf_ref: string | null;
      sdf_doc_url: string | null;
    }[] | null) ?? [];
    if (guests.length === 0) {
      stays.push({
        guestId: `contact-${b.id}`,
        full_name: (b.contact_name as string) || "Guest",
        nationality: null,
        passport_or_cid: null,
        sdf_ref: null,
        sdf_doc_url: null,
        booking_id: b.id as string,
        contact_phone: (b.contact_phone as string | null) ?? null,
        check_in: b.check_in as string,
        check_out: b.check_out as string,
        status: b.status as string,
        guest_origin: (b.guest_origin as string | null) ?? null,
      });
      continue;
    }
    for (const g of guests) {
      stays.push({
        guestId: g.id,
        full_name: g.full_name || (b.contact_name as string) || "Guest",
        nationality: g.nationality,
        passport_or_cid: g.passport_or_cid,
        sdf_ref: g.sdf_ref,
        sdf_doc_url: g.sdf_doc_url,
        booking_id: b.id as string,
        contact_phone: (b.contact_phone as string | null) ?? null,
        check_in: b.check_in as string,
        check_out: b.check_out as string,
        status: b.status as string,
        guest_origin: (b.guest_origin as string | null) ?? null,
      });
    }
  }

  const filtered = stays.filter((s) =>
    matchesQuery(
      [s.full_name, s.nationality, s.passport_or_cid, s.sdf_ref, s.contact_phone, s.booking_id],
      query,
    ),
  );

  // Aggregate stay counts by passport/name key for repeat recognition
  const stayCount = new Map<string, number>();
  for (const s of stays) {
    const key = (s.passport_or_cid || s.full_name).toLowerCase();
    stayCount.set(key, (stayCount.get(key) ?? 0) + 1);
  }

  return (
    <DeskListShell
      title="Guests"
      eyebrow="Directory"
      heading="Guest list"
      blurb="Derived from booking guests and contacts. Search by name, passport/CID, SDF, or phone."
      filters={
        <DeskSearchForm
          action="/erp/guests"
          q={q}
          placeholder="Name, passport/CID, SDF, phone…"
        />
      }
    >
      <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      <DeskTable
        caption="Guests"
        headers={["Guest", "Nationality", "ID / SDF", "Stay", "Stays", "Status", ""]}
      >
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-muted-foreground">
              No guests match.
            </td>
          </tr>
        ) : (
          filtered.map((s) => {
            const key = (s.passport_or_cid || s.full_name).toLowerCase();
            const n = stayCount.get(key) ?? 1;
            return (
              <tr key={`${s.guestId}-${s.booking_id}`} className="border-t border-espresso/10">
                <td className="px-3 py-2.5">
                  <p className="font-medium text-espresso">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.contact_phone ?? "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {s.nationality ?? "—"}
                  {s.guest_origin ? (
                    <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-gold">
                      {s.guest_origin}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-espresso/70">
                  <div>{s.passport_or_cid ?? "—"}</div>
                  <div className="text-muted-foreground">SDF {s.sdf_ref ?? "—"}</div>
                  {s.sdf_doc_url ? (
                    <a
                      href={s.sdf_doc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-maroon underline-offset-2 hover:underline"
                    >
                      Doc
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-sm text-espresso">
                  {fmtDate(s.check_in)} → {fmtDate(s.check_out)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-espresso">{n}</td>
                <td className="px-3 py-2.5">
                  <StatusPill value={s.status} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <a
                    href={`/erp/check-in?booking=${s.booking_id}`}
                    className="text-sm text-maroon underline-offset-4 hover:underline"
                  >
                    Open →
                  </a>
                </td>
              </tr>
            );
          })
        )}
      </DeskTable>
    </DeskListShell>
  );
}
