import type { ReactNode } from "react";
import { amountInWordsNu } from "../lib/amount-in-words";
import type {
  AgentPrintInvoicePage,
  AgentPrintPackDoc,
} from "../lib/agent-print-pack";
import { formatNu } from "../lib/front-office-store";
import {
  AgentStatementView,
  type AgentStatementLetterhead,
} from "./AgentStatementView";
import type { AgentStatementDoc } from "../lib/b2b-portfolio";

function moneyPlain(n: number) {
  return n.toLocaleString("en-BT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(iso: string) {
  const d = iso.slice(0, 10);
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function Sheet({
  children,
  breakAfter = true,
  title,
}: {
  children: ReactNode;
  breakAfter?: boolean;
  title?: string;
}) {
  return (
    <section
      className={`hos-print-pack-sheet mx-auto mb-6 w-full max-w-[210mm] bg-white text-[#111] shadow-sm ${
        breakAfter ? "hos-print-pack-break" : ""
      }`}
      aria-label={title}
    >
      <div className="border border-[#e5e7eb] p-6 sm:p-8">{children}</div>
    </section>
  );
}

function InvoicePage({
  page,
  letterhead,
}: {
  page: AgentPrintInvoicePage;
  letterhead: AgentStatementLetterhead;
}) {
  const scPct = Math.round((letterhead.scRate || 0) * 100);
  return (
    <Sheet
      title={`Invoice ${page.folioNo}`}
      breakAfter
    >
      <header className="border-b border-[#e5e7eb] pb-3 text-center">
        <h1 className="m-0 text-xl font-bold tracking-tight sm:text-2xl">
          {letterhead.hotelName}
        </h1>
        <p className="m-0 mt-1 text-[11px] text-[#4b5563]">
          {letterhead.dzongkhag}
          {letterhead.tpn ? ` · TPN ${letterhead.tpn}` : ""}
        </p>
        <h2 className="m-0 mt-3 text-sm font-bold uppercase tracking-[0.14em]">
          {page.status === "paid" ? "Paid invoice" : "Tax / agency invoice"}
        </h2>
      </header>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
            Bill to
          </div>
          <div className="mt-0.5 text-sm font-semibold">{page.guestRef}</div>
          <div className="text-[11px] text-[#4b5563]">
            {page.roomPlan}
            {page.roomNumber ? ` · Rm ${page.roomNumber}` : ""}
          </div>
        </div>
        <div className="sm:text-right text-[11px]">
          <div>
            Folio: <strong className="font-mono">{page.folioNo}</strong>
          </div>
          {page.taxInvoiceNo ? (
            <div>
              Tax INV: <strong className="font-mono">{page.taxInvoiceNo}</strong>
            </div>
          ) : null}
          {page.confirmationNo ? (
            <div>
              Conf: <strong className="font-mono">{page.confirmationNo}</strong>
            </div>
          ) : null}
          <div>
            Date: <strong>{shortDate(page.invDate)}</strong>
          </div>
          <div>
            Stay: <strong>{page.stayDates}</strong>
            {page.nights ? ` · ${page.nights}n` : ""}
          </div>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-left text-[10px] sm:text-[11px]">
        <thead>
          <tr className="border-b-2 border-[#111] text-[9px] uppercase tracking-wide text-[#6b7280]">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2 text-right">Net</th>
            <th className="py-2 pr-2 text-right">S.C.</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {page.lines.map((l) => (
            <tr key={l.id} className="border-b border-[#e5e7eb]">
              <td className="py-1.5 pr-2">{l.description}</td>
              <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                {moneyPlain(l.netAmount)}
              </td>
              <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                {moneyPlain(l.scAmount)}
              </td>
              <td className="py-1.5 text-right font-mono tabular-nums">
                {moneyPlain(l.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#111]">
            <td className="py-2 text-right text-xs font-bold uppercase" colSpan={3}>
              Amount due (Nu.)
            </td>
            <td className="py-2 text-right font-mono text-sm font-bold tabular-nums">
              {moneyPlain(page.balance > 0 ? page.balance : page.amount)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-2 text-[11px] text-[#374151]">
        <strong>In words:</strong>{" "}
        {amountInWordsNu(page.balance > 0 ? page.balance : page.amount)}.
      </p>
      <p className="m-0 text-[10px] text-[#6b7280]">
        Charged {formatNu(page.amount)} · Paid {formatNu(page.paid)} · Balance{" "}
        {formatNu(page.balance)}
        {letterhead.scEnabled ? ` · S.C. ${scPct}% where applied` : ""}
      </p>
    </Sheet>
  );
}

/** Full multi-section print pack body (summary → master → invoices → payments → appendix). */
export function AgentPrintPackView({
  pack,
  letterhead,
}: {
  pack: AgentPrintPackDoc;
  letterhead: AgentStatementLetterhead;
}) {
  const periodLabel = `${shortDate(pack.from)} – ${shortDate(pack.to)}`;

  return (
    <div className="hos-agent-print-pack-root space-y-0">
      {pack.summary ? (
        <Sheet title="Summary reports" breakAfter>
          <header className="border-b border-[#e5e7eb] pb-3 text-center">
            <h1 className="m-0 text-xl font-bold">{letterhead.hotelName}</h1>
            <h2 className="m-0 mt-2 text-sm font-bold uppercase tracking-[0.14em]">
              Operator summary · {pack.agentName}
            </h2>
            <p className="m-0 mt-1 text-[11px] text-[#4b5563]">
              {pack.agentCode} · {periodLabel}
            </p>
          </header>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded border border-[#e5e7eb] p-2">
              <div className="text-[9px] uppercase text-[#6b7280]">Nights</div>
              <div className="font-mono text-lg font-bold tabular-nums">
                {pack.summary.totalNights}
              </div>
            </div>
            <div className="rounded border border-[#e5e7eb] p-2">
              <div className="text-[9px] uppercase text-[#6b7280]">Stays</div>
              <div className="font-mono text-lg font-bold tabular-nums">
                {pack.summary.stayCount}
              </div>
            </div>
            <div className="rounded border border-[#e5e7eb] p-2">
              <div className="text-[9px] uppercase text-[#6b7280]">Paid</div>
              <div className="font-mono text-lg font-bold tabular-nums text-emerald-700">
                {moneyPlain(pack.summary.paidAmount)}
              </div>
            </div>
            <div className="rounded border border-[#e5e7eb] p-2">
              <div className="text-[9px] uppercase text-[#6b7280]">Unpaid</div>
              <div className="font-mono text-lg font-bold tabular-nums text-red-700">
                {moneyPlain(pack.summary.unpaidAmount)}
              </div>
            </div>
          </div>

          <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
            Nights by month
          </h3>
          <table className="mt-1 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#111] text-[9px] uppercase text-[#6b7280]">
                <th className="py-1 text-left">Month</th>
                <th className="py-1 text-right">Stays</th>
                <th className="py-1 text-right">Nights</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pack.summary.byMonth.map((m) => (
                <tr key={m.key} className="border-b border-[#e5e7eb]">
                  <td className="py-1">{m.label}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{m.stays}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{m.nights}</td>
                  <td className="py-1 text-right font-mono tabular-nums">
                    {moneyPlain(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                Meal plan mix
              </h3>
              <table className="mt-1 w-full border-collapse text-[11px]">
                <tbody>
                  {pack.summary.byMealPlan.map((r) => (
                    <tr key={r.key} className="border-b border-[#e5e7eb]">
                      <td className="py-1">{r.label}</td>
                      <td className="py-1 text-right font-mono tabular-nums">
                        {r.nights}n
                      </td>
                      <td className="py-1 text-right font-mono tabular-nums">
                        {moneyPlain(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                Room type mix
              </h3>
              <table className="mt-1 w-full border-collapse text-[11px]">
                <tbody>
                  {pack.summary.byRoomType.map((r) => (
                    <tr key={r.key} className="border-b border-[#e5e7eb]">
                      <td className="py-1">{r.label}</td>
                      <td className="py-1 text-right font-mono tabular-nums">
                        {r.count}
                      </td>
                      <td className="py-1 text-right font-mono tabular-nums">
                        {moneyPlain(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Sheet>
      ) : null}

      {pack.master ? (
        <div className="hos-print-pack-break mb-6">
          <AgentStatementView
            doc={pack.master as unknown as AgentStatementDoc}
            letterhead={letterhead}
            printRoot={false}
          />
          {pack.bank && (pack.bank.accountNo || pack.bank.mbobMerchantId) ? (
            <div className="mx-auto max-w-[210mm] border border-t-0 border-[#e5e7eb] bg-white px-6 pb-6 text-[11px] text-[#374151] sm:px-8">
              <div className="font-bold uppercase tracking-wide text-[#6b7280]">
                Payment instructions
              </div>
              <p className="m-0 mt-1">
                {pack.bank.accountName
                  ? `${pack.bank.accountName} · `
                  : ""}
                Bhutan National Bank
                {pack.bank.accountNo ? ` · A/C ${pack.bank.accountNo}` : ""}
                {pack.bank.mbobMerchantId
                  ? ` · mBoB ${pack.bank.mbobMerchantId}`
                  : ""}
              </p>
              {pack.bank.note ? (
                <p className="m-0 mt-0.5 text-[#6b7280]">{pack.bank.note}</p>
              ) : (
                <p className="m-0 mt-0.5 text-[#6b7280]">
                  Quote operator code {pack.agentCode} on the wire slip.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {pack.unpaidInvoices.map((page) => (
        <InvoicePage key={page.id} page={page} letterhead={letterhead} />
      ))}

      {pack.paidInvoices.map((page) => (
        <InvoicePage key={page.id} page={page} letterhead={letterhead} />
      ))}

      {pack.payments.length > 0 ? (
        <Sheet title="Payments ledger" breakAfter>
          <header className="border-b border-[#e5e7eb] pb-3 text-center">
            <h2 className="m-0 text-sm font-bold uppercase tracking-[0.14em]">
              Payments &amp; receipts · {pack.agentName}
            </h2>
            <p className="m-0 mt-1 text-[11px] text-[#4b5563]">{periodLabel}</p>
          </header>
          <table className="mt-3 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-[#111] text-[9px] uppercase text-[#6b7280]">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Ref</th>
                <th className="py-2 text-left">Guest</th>
                <th className="py-2 text-left">Method</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pack.payments.map((p) => (
                <tr key={p.id} className="border-b border-[#e5e7eb]">
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {shortDate(p.at)}
                  </td>
                  <td className="py-1.5 font-mono">{p.ref}</td>
                  <td className="py-1.5">{p.guestRef}</td>
                  <td className="py-1.5">{p.method}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {moneyPlain(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#111]">
                <td colSpan={4} className="py-2 text-right text-xs font-bold uppercase">
                  Total receipts
                </td>
                <td className="py-2 text-right font-mono font-bold tabular-nums">
                  {moneyPlain(pack.payments.reduce((n, p) => n + p.amount, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </Sheet>
      ) : null}

      {pack.aging || pack.mou ? (
        <Sheet title="Aging & MoU" breakAfter={false}>
          <header className="border-b border-[#e5e7eb] pb-3 text-center">
            <h2 className="m-0 text-sm font-bold uppercase tracking-[0.14em]">
              Credit appendix · {pack.agentName}
            </h2>
          </header>
          {pack.aging ? (
            <div className="mt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                Aging waterfall (Nu.)
              </h3>
              <table className="mt-1 w-full max-w-sm border-collapse text-[11px]">
                <tbody>
                  {(
                    [
                      ["Current", pack.aging.current],
                      ["30 days", pack.aging.d30],
                      ["60 days", pack.aging.d60],
                      ["90+ days", pack.aging.d90],
                      ["Total AR", pack.aging.total],
                    ] as const
                  ).map(([label, amt]) => (
                    <tr key={label} className="border-b border-[#e5e7eb]">
                      <td className="py-1">{label}</td>
                      <td className="py-1 text-right font-mono tabular-nums">
                        {moneyPlain(amt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {pack.mou ? (
            <div className="mt-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                MoU &amp; credit · {pack.mou.rateCardCode} · {pack.mou.season}
              </h3>
              <p className="m-0 mt-1 text-[11px] text-[#374151]">
                Limit {formatNu(pack.mou.creditLimit)} · Used{" "}
                {formatNu(pack.mou.usedCredit)} · Headroom{" "}
                {formatNu(pack.mou.headroom)} · Net terms {pack.mou.termsDays}{" "}
                days
              </p>
              {pack.mou.rates.length > 0 ? (
                <table className="mt-2 w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[#111] text-[9px] uppercase text-[#6b7280]">
                      <th className="py-1 text-left">Type</th>
                      <th className="py-1 text-left">Plan</th>
                      <th className="py-1 text-right">Single</th>
                      <th className="py-1 text-right">Double</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pack.mou.rates.map((r) => (
                      <tr
                        key={`${r.mealPlan}-${r.typeCode}`}
                        className="border-b border-[#e5e7eb]"
                      >
                        <td className="py-1">{r.typeLabel}</td>
                        <td className="py-1">{r.mealPlan}</td>
                        <td className="py-1 text-right font-mono tabular-nums">
                          {moneyPlain(r.singleNet)}
                        </td>
                        <td className="py-1 text-right font-mono tabular-nums">
                          {moneyPlain(r.doubleNet)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  );
}
