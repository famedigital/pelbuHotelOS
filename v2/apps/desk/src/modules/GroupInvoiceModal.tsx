/**
 * Combined agency / master bill for a tour group — same fiscal letterhead
 * design as InvoiceModal (A4 hos-fiscal-sheet).
 */
import { createPortal } from "react-dom";
import { useMemo } from "react";
import { Button } from "@hos-v2/ui";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { amountInWordsNu } from "../lib/amount-in-words";
import {
  folioBalance,
  folioTotals,
  groupMembers,
  nightsBetween,
  useFrontOfficeStore,
  type FolioLine,
  type Stay,
} from "../lib/front-office-store";
import { useSettingsStore } from "../lib/settings-store";
import { peekGaplessDocNoExternal } from "../lib/extras-store";

function moneyPlain(n: number) {
  return n.toLocaleString("en-BT", { maximumFractionDigits: 0 });
}

function shortDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function lineDesc(line: FolioLine): string {
  if (line.description?.trim()) return line.description.trim();
  if (line.kind === "room") return "Room charge";
  if (line.kind === "fb") return "F&B";
  if (line.kind === "payment") return "Payment";
  if (line.kind === "adjustment") return "Adjustment";
  return line.kind;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="mr-3 inline-block">
      <span className="text-[#5c534c]">{label}</span>
      <span className="px-1">:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function SignLine({ title, name }: { title: string; name: string }) {
  return (
    <div>
      <p className="font-semibold text-[#1a1410]">{title}</p>
      <div className="mt-6 border-b border-[#1a1410]" />
      <p className="mt-1 text-[10px] text-[#5c534c]">{name || "\u00a0"}</p>
    </div>
  );
}

export function GroupInvoiceModal({
  open,
  stays,
  groupName,
  agencyName,
  onClose,
}: {
  open: boolean;
  stays: Stay[];
  groupName: string | null;
  agencyName: string | null;
  onClose: () => void;
}) {
  const hotelName = useSettingsStore((s) => s.hotelName);
  const dzongkhag = useSettingsStore((s) => s.dzongkhag);
  const tpn = useSettingsStore((s) => s.tpn);
  const tradeLicense = useSettingsStore((s) => s.tradeLicense);
  const scRate = useSettingsStore((s) => s.scRate);
  const bstRate = useSettingsStore((s) => s.bstRate);
  const scEnabled = useSettingsStore((s) => s.scEnabled);
  const bstEnabled = useSettingsStore((s) => s.bstEnabled);
  const bnbAccountName = useSettingsStore((s) => s.bnbAccountName);
  const bnbAccountNo = useSettingsStore((s) => s.bnbAccountNo);
  const mbobMerchantId = useSettingsStore((s) => s.mbobMerchantId);
  const ensureFolioNo = useFrontOfficeStore((s) => s.ensureFolioNo);

  const peers = useMemo(
    () => stays.filter((s) => !["cancelled", "no_show"].includes(s.status)),
    [stays],
  );

  const chargeLines = useMemo(() => {
    const out: { stay: Stay; line: FolioLine }[] = [];
    for (const s of peers) {
      for (const l of s.folioLines) {
        if (l.stream !== "master" || l.voided || l.totalAmount < 0) continue;
        out.push({ stay: s, line: l });
      }
    }
    return out;
  }, [peers]);

  const paymentLines = useMemo(() => {
    const out: FolioLine[] = [];
    for (const s of peers) {
      for (const l of s.folioLines) {
        if (l.stream !== "master" || l.voided || l.totalAmount >= 0) continue;
        out.push(l);
      }
    }
    return out;
  }, [peers]);

  const totals = useMemo(() => {
    let net = 0;
    let sc = 0;
    let bst = 0;
    let charged = 0;
    let paid = 0;
    for (const s of peers) {
      const t = folioTotals(s, "master");
      net += t.net;
      sc += t.sc;
      bst += t.bst;
      charged += t.charged;
      paid += t.paid;
    }
    const balance = peers.reduce((n, s) => n + folioBalance(s, "master"), 0);
    return { net, sc, bst, charged, paid, balance };
  }, [peers]);

  const scPct = scEnabled ? Math.round(scRate * 100) : 0;
  const gstPct = bstEnabled ? Math.round(bstRate * 100) : 0;
  const billTo = agencyName?.trim() || groupName || "Agency";
  const confs = [...new Set(peers.map((p) => p.confirmationNo))].join(", ");
  const checkIn = peers[0]?.checkIn ?? "";
  const checkOut = peers[0]?.checkOut ?? "";
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const roomsLabel = peers
    .map((p) => p.roomNumber)
    .filter(Boolean)
    .join(", ");
  const committedFns = peers
    .map((p) => p.folioNo)
    .filter((n): n is string => Boolean(n?.trim()));
  const folioNo = committedFns[0] ?? peekGaplessDocNoExternal("FN");
  const invHint = peekGaplessDocNoExternal("INV");
  const folioLabel =
    committedFns.length > 1
      ? `${committedFns[0]} (+${committedFns.length - 1})`
      : committedFns.length === 1
        ? committedFns[0]!
        : `${folioNo} · draft`;
  const issueDate = shortDate(new Date().toISOString().slice(0, 10));
  const payableWords = amountInWordsNu(Math.max(0, totals.balance));

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-end justify-center bg-[rgba(15,23,42,0.55)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Group agency bill"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[96vh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] shadow-[0_24px_64px_-20px_rgba(15,23,42,0.55)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="hos-invoice-chrome-hide no-print flex items-start justify-between gap-3 border-b border-[var(--hos-line)] bg-[var(--hos-cell)] px-4 py-3">
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--hos-brass-ink)]">
              Group master bill · fiscal paper
            </p>
            <h2 className="m-0 truncate text-[17px] font-semibold tracking-tight text-[var(--hos-ink)]">
              {billTo}
            </h2>
            <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
              {groupName ?? "Tour party"} · {peers.length} rooms · Folio{" "}
              {folioLabel} · next tax {invHint}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="!h-9 !rounded-xl"
              onClick={() => {
                for (const p of peers) {
                  const res = ensureFolioNo(p.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                }
                window.setTimeout(() => window.print(), 50);
                toast.success("Group bill print · FN allocated");
              }}
            >
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="!h-9 !min-w-9 !rounded-xl !px-2"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div className="hos-fiscal-stage hos-scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#ebe6df] p-4 sm:p-6">
          <article
            id="hos-print-root"
            className="hos-fiscal-sheet mx-auto flex w-full max-w-[210mm] flex-col bg-white px-[12mm] py-[8mm] text-[#1a1410] shadow-[0_16px_40px_rgba(26,20,16,0.16)]"
          >
            <header className="flex items-start justify-between gap-3 border-b-2 border-[#1a1410] pb-2">
              <div className="min-w-0">
                <p className="text-[20px] leading-tight font-bold tracking-wide text-[#1a1410]">
                  {hotelName.toUpperCase()}
                </p>
                <p className="mt-0.5 text-[10px] font-bold tracking-[0.16em] text-[#6e2c2c] uppercase">
                  Hotel · {dzongkhag}
                </p>
                <address className="mt-1 text-[11px] leading-snug text-[#3a322c] not-italic">
                  <span className="block">
                    {[
                      `${dzongkhag}, Bhutan`,
                      tpn ? `TPN ${tpn}` : null,
                      tradeLicense ? `Lic. ${tradeLicense}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </address>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-bold tracking-[0.22em] text-[#6e2c2c] uppercase">
                  Agency master bill
                </p>
                <h3 className="mt-0.5 text-[18px] font-semibold tracking-wide text-[#1a1410]">
                  FOLIO {folioLabel}
                </h3>
                <table className="ml-auto mt-1 border-collapse text-[12px]">
                  <tbody>
                    <tr>
                      <td className="pr-3 text-right text-[#5c534c]">Date</td>
                      <td className="text-left font-medium text-[#1a1410]">
                        {issueDate}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-right text-[#5c534c]">Currency</td>
                      <td className="text-left font-medium text-[#1a1410]">
                        Nu (BTN)
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-right text-[#5c534c]">Rooms</td>
                      <td className="text-left font-medium text-[#1a1410]">
                        {peers.length}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </header>

            <p className="mt-1.5 text-[11px] leading-tight">
              <Fact label="Party" value={groupName ?? "Tour party"} />
              <Fact label="Agent" value={billTo} />
              <Fact label="Rooms" value={roomsLabel || String(peers.length)} />
              <Fact
                label="Stay"
                value={`${shortDate(checkIn)} → ${shortDate(checkOut)}${
                  nights ? ` · ${nights}n` : ""
                }`}
              />
              {confs ? <Fact label="Conf" value={confs} /> : null}
            </p>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-sm border border-[#d8d0c6] bg-[#f7f4ef] px-2.5 py-2">
                <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
                  Bill to
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-[#1a1410]">
                  {billTo}
                </p>
                <p className="mt-0.5 text-[11px] text-[#3a322c]">
                  Agency folio · room + meals for all party rooms
                </p>
              </div>
              <div className="rounded-sm border border-[#d8d0c6] bg-[#f7f4ef] px-2.5 py-2">
                <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
                  From
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-[#1a1410]">
                  {hotelName}
                </p>
                <p className="mt-0.5 text-[11px] text-[#3a322c]">
                  {[
                    `${peers.length} room${peers.length === 1 ? "" : "s"}`,
                    `${shortDate(checkIn)} → ${shortDate(checkOut)}`,
                    nights ? `${nights} night${nights === 1 ? "" : "s"}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            <div className="mt-3 flex-1">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#1a1410] text-white">
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-left font-semibold">
                      Rm
                    </th>
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-left font-semibold">
                      Guest
                    </th>
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-left font-semibold">
                      Description
                    </th>
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-left font-semibold">
                      Arrv
                    </th>
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-left font-semibold">
                      Dept
                    </th>
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-right font-semibold">
                      Nights
                    </th>
                    <th className="border border-[#1a1410] px-1.5 py-1.5 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chargeLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-[#1a1410] px-2 py-6 text-center text-[#5c534c]"
                      >
                        No agency lines yet — check in posts room + meal package
                        to master.
                      </td>
                    </tr>
                  ) : (
                    chargeLines.map(({ stay, line }, i) => {
                      const isRoom = line.kind === "room";
                      const n = nightsBetween(stay.checkIn, stay.checkOut);
                      return (
                        <tr key={`${stay.id}-${line.id}-${i}`} className="align-top">
                          <td className="border border-[#1a1410] px-1.5 py-1 font-medium">
                            {stay.roomNumber ?? "—"}
                          </td>
                          <td className="border border-[#1a1410] px-1.5 py-1">
                            {stay.guestName}
                          </td>
                          <td className="border border-[#1a1410] px-1.5 py-1">
                            {lineDesc(line)}
                          </td>
                          <td className="border border-[#1a1410] px-1.5 py-1 whitespace-nowrap">
                            {isRoom ? shortDate(stay.checkIn) : "—"}
                          </td>
                          <td className="border border-[#1a1410] px-1.5 py-1 whitespace-nowrap">
                            {isRoom ? shortDate(stay.checkOut) : "—"}
                          </td>
                          <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums">
                            {isRoom ? n || "—" : "—"}
                          </td>
                          <td className="border border-[#1a1410] px-1.5 py-1 text-right font-medium tabular-nums">
                            {moneyPlain(line.totalAmount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={5}
                      rowSpan={4}
                      className="border border-[#1a1410] px-2 py-2 align-top text-[10px] leading-snug text-[#3a322c]"
                    >
                      <p className="font-semibold text-[#1a1410]">Tax summary</p>
                      <p className="mt-1">
                        Service charge {scPct}% and Bhutan Sales Tax (GST){" "}
                        {gstPct}% applied on taxable room / F&amp;B nets where
                        enabled in property fiscal settings. Guest laundry /
                        minibar remain on each room’s personal folio.
                      </p>
                    </td>
                    <td className="border border-[#1a1410] bg-[#f7f4ef] px-1.5 py-1 text-right font-medium">
                      Subtotal
                    </td>
                    <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums">
                      {moneyPlain(totals.net)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#1a1410] bg-[#f7f4ef] px-1.5 py-1 text-right font-medium">
                      SC {scPct}%
                    </td>
                    <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums">
                      {moneyPlain(totals.sc)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#1a1410] bg-[#f7f4ef] px-1.5 py-1 text-right font-medium">
                      GST {gstPct}%
                    </td>
                    <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums">
                      {moneyPlain(totals.bst)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#1a1410] bg-[#1a1410] px-1.5 py-1.5 text-right font-bold text-white">
                      Net payable
                    </td>
                    <td className="border border-[#1a1410] bg-[#1a1410] px-1.5 py-1.5 text-right font-bold text-white tabular-nums">
                      {moneyPlain(totals.charged)}
                    </td>
                  </tr>
                  {totals.paid > 0 ? (
                    <>
                      <tr>
                        <td
                          colSpan={5}
                          className="border border-[#1a1410] px-2 py-1 text-[10px] text-[#5c534c]"
                        >
                          {paymentLines.length
                            ? paymentLines
                                .map(
                                  (p) =>
                                    `${lineDesc(p)} ${moneyPlain(Math.abs(p.totalAmount))}`,
                                )
                                .join(" · ")
                            : "Payments received"}
                        </td>
                        <td className="border border-[#1a1410] bg-[#f7f4ef] px-1.5 py-1 text-right font-medium">
                          Paid
                        </td>
                        <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums text-[#0f6b4c]">
                          −{moneyPlain(totals.paid)}
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={5}
                          className="border border-[#1a1410] px-2 py-1"
                        />
                        <td className="border border-[#1a1410] bg-[#f7f4ef] px-1.5 py-1.5 text-right font-bold">
                          Balance
                        </td>
                        <td className="border border-[#1a1410] px-1.5 py-1.5 text-right font-bold tabular-nums">
                          {moneyPlain(totals.balance)}
                        </td>
                      </tr>
                    </>
                  ) : null}
                </tfoot>
              </table>
            </div>

            <p className="mt-2 text-[11px] leading-snug">
              <span className="font-semibold">Amount payable (in words)</span>
              <span className="mt-0.5 block uppercase">{payableWords}</span>
            </p>

            <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-[11px]">
              <SignLine title="Bill prepared by" name="Front desk" />
              <SignLine title="Authorized signatory" name={hotelName} />
              <SignLine title="Agency acknowledgement" name="" />
              <div>
                <p className="font-semibold">For, {hotelName}</p>
              </div>
            </section>

            {bnbAccountNo || mbobMerchantId ? (
              <section className="mt-4 border border-[#d8d0c6] bg-[#f7f4ef] px-3 py-2.5 text-[11px]">
                <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
                  Payment
                </p>
                {bnbAccountNo ? (
                  <p className="mt-1 text-[#3a322c]">
                    Bank · {bnbAccountName || "BNB"} · A/C {bnbAccountNo}
                  </p>
                ) : null}
                {mbobMerchantId ? (
                  <p className="mt-0.5 text-[#3a322c]">
                    mBoB merchant · {mbobMerchantId}
                  </p>
                ) : null}
              </section>
            ) : null}
          </article>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function groupPeersForInvoice(allStays: Stay[], groupId: string): Stay[] {
  return groupMembers(allStays, groupId);
}
