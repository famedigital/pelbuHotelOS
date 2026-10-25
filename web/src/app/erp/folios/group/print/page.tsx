import { FolioBillArticle } from "@/components/erp/print/FolioBillArticle";
import { FolioPreviewFit } from "@/components/erp/print/FolioPreviewFit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDeparturePrintList } from "@/lib/folio/departure-print-list";
import { loadFolioBillView, type FolioBillView } from "@/lib/folio/load-folio-bill-view";
import type { BillKind } from "@/lib/folio/bill-kinds";
import { addIsoDays } from "@/lib/erp/occupancy-nights";
import { formatGuestBtn } from "@/lib/pricing";
import { thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const PACK: BillKind[] = ["room", "fnb", "master"];

export const metadata = {
  title: "Group bills",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DepartureGroupPrintPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();
  const [departures, tomorrowDepartures] = await Promise.all([
    loadDeparturePrintList(admin, propertyId, today),
    loadDeparturePrintList(admin, propertyId, addIsoDays(today, 1)),
  ]);
  const views = (
    await Promise.all(
      departures.flatMap((row) =>
        PACK.map((kind) => loadFolioBillView(admin, propertyId, row.folioId, kind)),
      ),
    )
  ).filter((view): view is FolioBillView => view != null);

  return (
    <FolioPreviewFit
      backHref="/erp/day#departures"
      backLabel="Back to the day"
      printLabel="Print group"
      initialMode="continuous"
      fullPage
      group={{
        title: "Departures",
        sections: [
          {
            title: "Today",
            items: departures.map((row) => ({
              id: `today-${row.folioId}`,
              href: `/erp/folios/${row.folioId}/bill`,
              label: row.guest,
              agent: row.agent || null,
              rooms: row.rooms || null,
              amount: row.amountBtn != null ? formatGuestBtn(row.amountBtn) : null,
              meta: [row.rooms, row.confirmation].filter(Boolean).join(" · "),
              active: false,
            })),
          },
          {
            title: "Tomorrow",
            items: tomorrowDepartures.map((row) => ({
              id: `tomorrow-${row.folioId}`,
              href: `/erp/folios/${row.folioId}/bill`,
              label: row.guest,
              agent: row.agent || null,
              rooms: row.rooms || null,
              amount: row.amountBtn != null ? formatGuestBtn(row.amountBtn) : null,
              meta: [row.rooms, row.confirmation].filter(Boolean).join(" · "),
              active: false,
            })),
          },
        ],
      }}
    >
      {views.length ? (
        views.map((view) => (
          <FolioBillArticle key={`${view.folioId}-${view.bill}`} view={view} />
        ))
      ) : (
        <article className="folio-a4 flex w-[210mm] min-h-[120mm] items-center justify-center bg-white p-8 text-sm">
          No departure folios to print today.
        </article>
      )}
    </FolioPreviewFit>
  );
}
