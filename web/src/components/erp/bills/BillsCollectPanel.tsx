import { CollectPaymentButton } from "@/components/erp/bills/CollectPaymentButton";
import { Button } from "@/components/ui/button";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadCollectDesk } from "@/lib/erp/collect-desk";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function fmt(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

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
          Record a payment here. It stays on the folio, including after checkout. Open the bill to change the rate or the room charge.
        </p>
      </div>

      {desk.agents.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-8 text-sm text-muted-foreground">
          Nothing left to collect on stays that are in house or checked out.
        </p>
      ) : (
        desk.agents.map((agent) => (
          <section key={agent.key} className="overflow-hidden rounded-md border">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <h2 className="text-sm font-semibold">
                {agent.agentId ? (
                  <Link href={`/erp/agents/${agent.agentId}`} className="hover:underline">
                    {agent.name}
                  </Link>
                ) : (
                  agent.name
                )}
              </h2>
              <p className="text-sm tabular-nums">
                <span className="text-muted-foreground">To collect </span>
                <span className="font-semibold">{formatBtn(agent.due)}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">Guest</th>
                    <th className="px-3 py-2 font-medium">Stay</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">Bill</th>
                    <th className="px-3 py-2 text-right font-medium">Paid</th>
                    <th className="px-3 py-2 text-right font-medium">Unpaid</th>
                    <th className="px-3 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {agent.stays.map((stay) => (
                    <tr key={stay.bookingId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium">{stay.guest}</p>
                        <p className="text-xs text-muted-foreground">{stay.confirmation}</p>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmt(stay.checkIn)} – {fmt(stay.checkOut)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {stay.rate != null ? formatBtn(stay.rate) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBtn(stay.bill)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBtn(stay.paid)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatBtn(stay.due)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {stay.folioId ? (
                            <CollectPaymentButton
                              folioId={stay.folioId}
                              bookingId={stay.bookingId}
                              due={stay.due}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">No folio</span>
                          )}
                          {stay.folioId ? (
                            <Button asChild variant="ghost" size="sm" className="h-8">
                              <Link href={stayFolioHref(stay.bookingId, stay.folioId)}>Open bill</Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
