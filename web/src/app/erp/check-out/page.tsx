import { CheckOutForm } from "@/components/erp/CheckInForm";
import { FolioPaymentForm } from "@/components/erp/FolioPaymentForm";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Check-out | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; id?: string }>;
};

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type FolioLine = {
  id: string;
  description: string;
  total_btn: number;
  source_type: string;
  status: string;
  created_at: string;
};

export default async function CheckOutPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const id = (sp.id ?? "").trim() || undefined;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();

  const inHouse = await loadInHouse(admin, propertyId, query);
  const selected = id ? await loadStay(admin, propertyId, id) : null;

  return (
    <div className="erp mx-auto grid w-full max-w-[1200px] gap-6 p-4 md:grid-cols-[320px_minmax(0,1fr)] md:p-6">
      {!deskPinConfigured() ? (
        <Alert variant="warning" className="md:col-span-2">
          <AlertTitle>Dev mode: desk PIN not set.</AlertTitle>
        </Alert>
      ) : null}

      <aside className="min-w-0 space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Check-out
          </p>
          <FrontDeskLiveRefresh />
        </div>
        <Card className="gap-3 p-4">
          <form className="space-y-3">
            <label className="block text-sm text-foreground">
              Find in-house guest
              <Input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Room, phone, or name"
                className="mt-1.5"
              />
            </label>
            <Button type="submit" className="w-full">
              Search
            </Button>
          </form>
          <Button asChild variant="outline" className="w-full">
            <Link href="/erp/departures">Due out today</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/erp/in-house">In-house board</Link>
          </Button>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <h2 className="border-b px-4 py-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            In-house
          </h2>
          <ul className="divide-y">
            {inHouse.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted-foreground">
                No in-house stays match.
              </li>
            ) : (
              inHouse.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/erp/check-out?id=${row.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                    className="block px-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <p className="font-medium text-foreground">
                      {row.contact_name ?? "Guest"}
                      {row.rooms_label ? ` · ${row.rooms_label}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      out {row.check_out}
                      {row.check_out === today ? " · due today" : ""}
                      {row.balance > 0
                        ? ` · balance ${formatBtn(row.balance)}`
                        : " · settled"}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
      </aside>

      <div className="min-w-0 space-y-6">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Pick an in-house guest to review the folio, take final payment, and
            check out. Rooms are released to housekeeping as dirty on confirm.
          </p>
        ) : (
          <>
            <Card className="gap-0 p-6 text-sm">
              <p className="text-xs tracking-[0.2em] text-accent uppercase">
                Departing
              </p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {selected.contact_name ?? "Guest"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {fmtDate(selected.check_in)} → {fmtDate(selected.check_out)}
                {selected.rooms_label ? ` · ${selected.rooms_label}` : ""}
                {selected.contact_phone ? ` · ${selected.contact_phone}` : ""}
              </p>
              <p className="mt-3 text-sm">
                Folio balance{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    selected.balance > 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {formatBtn(selected.balance)}
                </span>
              </p>
              {selected.folioId ? (
                <Link
                  href={`/erp/folios/${selected.folioId}`}
                  className="mt-3 inline-flex min-h-10 items-center text-sm text-accent underline-offset-4 hover:underline"
                >
                  Open full folio
                </Link>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No open folio on this stay.
                </p>
              )}
            </Card>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="gap-0 overflow-hidden p-0">
                <h2 className="border-b px-5 py-3 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                  Folio lines ({selected.lines.length})
                </h2>
                <ul className="divide-y">
                  {selected.lines.length === 0 ? (
                    <li className="px-5 py-6 text-sm text-muted-foreground">
                      Nothing posted yet. Room, F&amp;B, laundry and other
                      charges appear here before settlement.
                    </li>
                  ) : (
                    selected.lines.map((line) => (
                      <li key={line.id} className="px-5 py-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="min-w-0 flex-1 text-foreground">
                            {line.description}
                          </p>
                          <p className="tabular-nums text-foreground">
                            {formatBtn(Number(line.total_btn))}
                          </p>
                        </div>
                        <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
                          {line.source_type}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </Card>

              <div className="space-y-4">
                {selected.folioId && selected.balance > 0 ? (
                  <FolioPaymentForm
                    folioId={selected.folioId}
                    suggestedAmount={selected.balance}
                  />
                ) : null}
                <CheckOutForm
                  bookingId={selected.id}
                  rooms={selected.rooms}
                  folioBalance={selected.balance}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

type InHouseRow = {
  id: string;
  contact_name: string | null;
  check_out: string;
  rooms_label: string;
  balance: number;
};

async function loadInHouse(
  admin: Admin,
  propertyId: string,
  query: string,
): Promise<InHouseRow[]> {
  let q = admin
    .from("bookings")
    .select(
      "id, contact_name, contact_phone, check_in, check_out, room_assignments(room_units(label)), folios(id, status, folio_lines(total_btn, status))",
    )
    .eq("property_id", propertyId)
    .eq("status", "checked_in")
    .order("check_out", { ascending: true })
    .limit(50);

  if (query) {
    const safe = query.replace(/[%(),]/g, "");
    q = q.or(`contact_phone.ilike.%${safe}%,contact_name.ilike.%${safe}%`);
  }

  const { data } = await q;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    contact_name: (row.contact_name as string | null) ?? null,
    check_out: row.check_out as string,
    rooms_label: roomLabels(row).join(", "),
    balance: openFolioBalance(row).balance,
  }));
}

async function loadStay(admin: Admin, propertyId: string, id: string) {
  const { data: row } = await admin
    .from("bookings")
    .select(
      "id, contact_name, contact_phone, check_in, check_out, status, room_assignments(room_units(label)), folios(id, status, folio_lines(id, description, total_btn, source_type, status, created_at))",
    )
    .eq("property_id", propertyId)
    .eq("id", id)
    .maybeSingle();

  if (!row || (row.status as string) !== "checked_in") return null;

  const rooms = roomLabels(row);
  const { balance, folioId, lines } = openFolioBalance(row);

  return {
    id: row.id as string,
    contact_name: (row.contact_name as string | null) ?? null,
    contact_phone: (row.contact_phone as string | null) ?? null,
    check_in: row.check_in as string,
    check_out: row.check_out as string,
    rooms,
    rooms_label: rooms.join(", "),
    balance,
    folioId,
    lines,
  };
}

function roomLabels(row: Record<string, unknown>): string[] {
  const assigns =
    (row.room_assignments as
      | Array<{ room_units: { label?: string } | { label?: string }[] | null }>
      | null) ?? [];
  return assigns
    .map((a) => {
      const unit = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
      return unit?.label ?? null;
    })
    .filter((label): label is string => Boolean(label));
}

function openFolioBalance(row: Record<string, unknown>): {
  balance: number;
  folioId: string | null;
  lines: FolioLine[];
} {
  const folios =
    (row.folios as
      | Array<{
          id?: string;
          status?: string;
          folio_lines?: Partial<FolioLine>[] | null;
        }>
      | null) ?? [];
  const folio = folios.find((f) => f.status === "open") ?? folios[0];
  if (!folio) return { balance: 0, folioId: null, lines: [] };

  const lines = (folio.folio_lines ?? []).filter(
    (l) => l.status === "posted",
  ) as FolioLine[];
  const balance = lines.reduce((sum, l) => sum + Number(l.total_btn ?? 0), 0);
  const sorted = [...lines].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime(),
  );
  return { balance, folioId: (folio.id as string) ?? null, lines: sorted };
}
