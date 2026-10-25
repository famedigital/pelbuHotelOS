import { FolioBillArticle } from "@/components/erp/print/FolioBillArticle";
import { FolioPreviewFit } from "@/components/erp/print/FolioPreviewFit";
import { FolioPrintToolbar } from "@/components/erp/print/FolioPrintToolbar";
import { FolioTaxActions } from "@/components/erp/print/FolioTaxActions";
import { PrintFileTitle } from "@/components/erp/print/PrintFileTitle";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDeparturePrintList } from "@/lib/folio/departure-print-list";
import { parseBillKind, type BillKind } from "@/lib/folio/bill-kinds";
import { loadFolioBillView, type FolioBillView } from "@/lib/folio/load-folio-bill-view";
import { folioPrintFileName } from "@/lib/hotel-doc-no";
import { formatGuestBtn } from "@/lib/pricing";
import { addIsoDays } from "@/lib/erp/occupancy-nights";
import { thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const PACK: BillKind[] = ["room", "fnb", "master"];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bill?: string; pack?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const quiet = { title: { absolute: "Folio" }, robots: { index: false, follow: false } };
  if (!(await isDeskAuthenticated())) return quiet;
  const { id } = await params;
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("folios")
    .select("doc_no, label, booking_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return quiet;
  let guestName = ((data.label as string | null) ?? "").trim();
  let agentName: string | null = null;
  let groupName: string | null = null;
  const bookingId = (data.booking_id as string | null) ?? null;
  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select("contact_name, agents(company_name)")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking) {
      guestName = ((booking.contact_name as string | null) ?? "").trim() || guestName;
      const agent = booking.agents as
        | { company_name?: string | null }
        | { company_name?: string | null }[]
        | null;
      const agentRow = Array.isArray(agent) ? agent[0] : agent;
      agentName = agentRow?.company_name?.trim() || null;
    }
    const { data: memberships } = await admin
      .from("booking_group_members")
      .select("booking_groups(name)")
      .eq("booking_id", bookingId)
      .limit(1);
    const membership = (memberships?.[0] ?? null) as {
      booking_groups?: { name?: string | null } | { name?: string | null }[] | null;
    } | null;
    const group = membership?.booking_groups;
    const groupRow = Array.isArray(group) ? group[0] : group;
    groupName = groupRow?.name?.trim() || null;
  }
  const title = folioPrintFileName({
    pack: sp.pack === "stay",
    bill: parseBillKind(sp.bill),
    folioNo: ((data.doc_no as string | null) ?? "").trim() || "Folio",
    agentName,
    guestName,
    groupName,
  });
  return {
    title: { absolute: title || "Folio" },
    robots: { index: false, follow: false },
  };
}

export default async function FolioBillPage({ params, searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const sp = await searchParams;
  const pack = sp.pack === "stay";
  const bill = parseBillKind(sp.bill);
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();
  const [loaded, todayDepartures, tomorrowDepartures] = await Promise.all([
    pack
      ? Promise.all(PACK.map((kind) => loadFolioBillView(admin, propertyId, id, kind)))
      : loadFolioBillView(admin, propertyId, id, bill).then((view) => [view]),
    loadDeparturePrintList(admin, propertyId, today),
    loadDeparturePrintList(admin, propertyId, addIsoDays(today, 1)),
  ]);
  const views = loaded.filter((view): view is FolioBillView => view != null);
  const view = views[0];
  if (!view) notFound();

  const toItems = (
    rows: typeof todayDepartures,
    section: string,
  ) =>
    rows.map((row) => ({
      id: `${section}-${row.folioId}`,
      href: `/erp/folios/${row.folioId}/bill`,
      label: row.guest,
      agent: row.agent || null,
      rooms: row.rooms || null,
      amount: row.amountBtn != null ? formatGuestBtn(row.amountBtn) : null,
      meta: [row.rooms, row.confirmation].filter(Boolean).join(" · "),
      active: row.folioId === id,
    }));
  const todayItems = toItems(todayDepartures, "today");
  const tomorrowItems = toItems(tomorrowDepartures, "tomorrow");
  if (![...todayItems, ...tomorrowItems].some((item) => item.active)) {
    todayItems.unshift({
      id: `today-${id}`,
      href: `/erp/folios/${id}/bill`,
      label: view.guestName,
      agent: view.agentName,
      rooms: view.roomsLabel,
      amount: formatGuestBtn(view.masterTotal),
      meta: view.confirmation ?? "This bill",
      active: true,
    });
  }

  const fileTitle = folioPrintFileName({
    pack,
    bill,
    folioNo: view.folioNo,
    agentName: view.agentName,
    guestName: view.guestName,
    groupName: view.groupName,
  });

  return (
    <FolioPreviewFit
      backHref={view.backHref}
      backLabel="Back to folio"
      allowThermal={!pack && bill === "fnb"}
      printLabel={pack ? "Print group" : "Print / PDF"}
      initialMode="page"
      toolbar={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FolioPrintToolbar folioId={id} active={pack ? "group" : bill} />
          <FolioTaxActions
            folioId={view.folioId}
            folioNo={view.folioNo}
            masterTotal={view.masterTotal}
            receivedTotal={view.receivedTotal}
            taxInvoiceNo={view.taxInvoiceNo}
            receiptNo={view.receiptNo}
            canIssue={view.canIssueTaxPair}
          />
        </div>
      }
      group={{
        title: "Departures",
        printHref: `/erp/folios/${id}/bill?pack=stay`,
        sections: [
          { title: "Today", items: todayItems },
          { title: "Tomorrow", items: tomorrowItems },
        ],
      }}
    >
      <PrintFileTitle title={fileTitle} />
      {views.map((paper) => (
        <FolioBillArticle key={`${paper.folioId}-${paper.bill}`} view={paper} />
      ))}
    </FolioPreviewFit>
  );
}
