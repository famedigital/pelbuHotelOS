import { CollectAgentSection } from "@/components/erp/bills/CollectAgentSection";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadCollectDesk } from "@/lib/erp/collect-desk";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Who still owes Pelbu, stay by stay, with a payment the desk can record. */
export async function BillsCollectPanel() {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const desk = await loadCollectDesk(admin, propertyId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div>
          <p className="text-sm text-muted-foreground">Still to collect since 1 Aug</p>
          <p className="text-2xl font-semibold tabular-nums">{formatBtn(desk.due)}</p>
          <p className="text-sm text-muted-foreground">
            {desk.agents.length} accounts · bills {formatBtn(desk.bill)} · already paid{" "}
            {formatBtn(desk.paid)}
          </p>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          Record a payment here. It stays on the folio, including after checkout. Tick stays to print one master bill, or open a bill to change the rate or the room charge.
        </p>
      </div>

      {desk.agents.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-8 text-sm text-muted-foreground">
          Nothing left to collect on stays that are in house or checked out.
        </p>
      ) : (
        desk.agents.map((agent) => (
          <CollectAgentSection
            key={agent.key}
            agentId={agent.agentId}
            name={agent.name}
            due={agent.due}
            stays={agent.stays.map((stay) => ({
              bookingId: stay.bookingId,
              folioId: stay.folioId,
              confirmation: stay.confirmation,
              guest: stay.guest,
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              rate: stay.rate,
              bill: stay.bill,
              paid: stay.paid,
              due: stay.due,
            }))}
          />
        ))
      )}
    </div>
  );
}
