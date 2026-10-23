import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadCashierStrip } from "@/lib/erp/cashier-desk";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Same totals on every cashier tab. */
export async function CashierMoneyStrip() {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const strip = await loadCashierStrip(admin, propertyId);
  const takenHint =
    strip.otherBtn > 0.5
      ? `Other ${formatBtn(strip.otherBtn)} · taken ${formatBtn(strip.takenTodayBtn)}`
      : `Taken ${formatBtn(strip.takenTodayBtn)}`;

  return (
    <DeskMetricRow
      className="sm:grid-cols-3 lg:grid-cols-6"
      metrics={[
        {
          label: "To collect",
          value: formatBtn(strip.toCollectBtn),
          href: "/erp/bills?tab=collect",
          tone: strip.toCollectBtn > 0.5 ? "destructive" : "default",
        },
        {
          label: "Open bills",
          value: String(strip.openFolios),
          href: "/erp/bills?tab=stay",
        },
        {
          label: "Cash today",
          value: formatBtn(strip.cashBtn),
          href: "/erp/bills?tab=payments",
        },
        {
          label: "Bank today",
          value: formatBtn(strip.bankBtn),
          href: "/erp/bills?tab=payments",
          hint: takenHint,
        },
        {
          label: "QR today",
          value: formatBtn(strip.qrBtn),
          href: "/erp/bills?tab=payments",
        },
        {
          label: "Invoices today",
          value: String(strip.invoicesToday),
          href: "/erp/bills?tab=invoices",
        },
      ]}
    />
  );
}
