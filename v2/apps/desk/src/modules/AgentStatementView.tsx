import { amountInWordsNu } from "../lib/amount-in-words";
import type { AgentStatementDoc } from "../lib/b2b-portfolio";
import { formatNu } from "../lib/front-office-store";
import { PaidUnpaidBar } from "./PaidUnpaidBar";

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

export type AgentStatementLetterhead = {
  hotelName: string;
  dzongkhag: string;
  tpn: string;
  phone?: string;
  email?: string;
  scEnabled: boolean;
  scRate: number;
};

/** Printable A4 statement of account for one B2B agent. */
export function AgentStatementView({
  doc,
  letterhead,
  printRoot = false,
}: {
  doc: AgentStatementDoc;
  letterhead: AgentStatementLetterhead;
  printRoot?: boolean;
}) {
  const scPct = Math.round((letterhead.scRate || 0) * 100);
  const periodLabel = `${shortDate(doc.from)} – ${shortDate(doc.to)}`;

  return (
    <article
      className={`hos-agent-soa mx-auto w-full max-w-[210mm] bg-white text-[#111] shadow-sm ${
        printRoot ? "hos-agent-soa-print-root" : ""
      }`}
    >
      <div className="border border-[#e5e7eb] p-6 sm:p-8">
        <header className="border-b border-[#e5e7eb] pb-4 text-center">
          <h1 className="m-0 text-xl font-bold tracking-tight sm:text-2xl">
            {letterhead.hotelName}
          </h1>
          <p className="m-0 mt-1 text-[11px] text-[#4b5563]">
            {letterhead.dzongkhag}
            {letterhead.phone ? ` · ${letterhead.phone}` : ""}
            {letterhead.email ? ` · ${letterhead.email}` : ""}
          </p>
          {letterhead.tpn ? (
            <p className="m-0 mt-0.5 text-[11px] font-semibold text-[#374151]">
              TPN No: {letterhead.tpn}
            </p>
          ) : null}
          <h2 className="m-0 mt-4 text-sm font-bold uppercase tracking-[0.14em]">
            Statement of Account
          </h2>
        </header>

        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
              To
            </div>
            <div className="mt-1 text-sm font-semibold">{doc.agentName}</div>
            <div className="text-[11px] text-[#4b5563]">
              {doc.agentCode}
              {doc.agentContact ? ` · ${doc.agentContact}` : ""}
            </div>
          </div>
          <div className="sm:text-right">
            <div>
              Statement date: <strong>{shortDate(doc.statementDate)}</strong>
            </div>
            <div>
              Billing period: <strong>{periodLabel}</strong>
            </div>
            <div>
              Invoices: <strong>{doc.lines.length}</strong>
            </div>
          </div>
        </div>

        <div className="mt-4 no-print">
          <PaidUnpaidBar paid={doc.totalPaid} unpaid={doc.totalDue} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[10px] sm:text-[11px]">
            <thead>
              <tr className="border-b-2 border-[#111] text-[9px] uppercase tracking-wide text-[#6b7280]">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Inv. date</th>
                <th className="py-2 pr-2">Folio / Inv.</th>
                <th className="py-2 pr-2">Guest / Ref.</th>
                <th className="py-2 pr-2">Room &amp; plan</th>
                <th className="py-2 pr-2">Stay dates</th>
                <th className="py-2 pr-2 text-right">Nts</th>
                <th className="py-2 text-right">Amount (Nu.)</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6b7280]">
                    No invoices in this period for this operator.
                  </td>
                </tr>
              ) : (
                doc.lines.map((line, i) => (
                  <tr key={line.id} className="border-b border-[#e5e7eb] align-top">
                    <td className="py-2 pr-2 tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                      {shortDate(line.invDate)}
                    </td>
                    <td className="py-2 pr-2 font-mono font-semibold">{line.folioNo}</td>
                    <td className="py-2 pr-2">{line.guestRef}</td>
                    <td className="py-2 pr-2">{line.roomPlan}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{line.stayDates}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {line.nights || "—"}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {moneyPlain(line.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#111]">
                <td colSpan={7} className="py-3 text-right text-xs font-bold uppercase">
                  Total net amount payable (Nu.)
                </td>
                <td className="py-3 text-right font-mono text-sm font-bold tabular-nums">
                  {moneyPlain(doc.totalDue > 0 ? doc.totalDue : doc.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[#374151]">
          <strong>Total amount payable (in words):</strong>{" "}
          {amountInWordsNu(doc.totalDue > 0 ? doc.totalDue : doc.totalAmount)}.
        </p>
        <p className="m-0 text-[10px] text-[#6b7280]">
          Collected {formatNu(doc.totalPaid)} · Outstanding {formatNu(doc.totalDue)} ·
          Gross billed {formatNu(doc.totalAmount)}
        </p>

        <div className="mt-4 text-[10px] text-[#4b5563]">
          <div className="font-bold uppercase tracking-wide text-[#6b7280]">Notes</div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            {letterhead.scEnabled ? (
              <li>
                Amounts are inclusive of applicable {scPct}% service charge where charged
                on the folio.
              </li>
            ) : (
              <li>Amounts follow the property tax and billing policy in force.</li>
            )}
            <li>Please settle outstanding dues as per MoU credit terms.</li>
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-[11px]">
          <div>
            <div className="min-h-[48px] border-b border-[#9ca3af]" />
            <div className="mt-1 text-[#6b7280]">Prepared by ({letterhead.hotelName})</div>
          </div>
          <div>
            <div className="min-h-[48px] border-b border-[#9ca3af]" />
            <div className="mt-1 text-[#6b7280]">Authorized signatory</div>
          </div>
        </div>
      </div>
    </article>
  );
}
