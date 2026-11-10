import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Button, FieldInput, useIsPhone } from "@hos-v2/ui";
import { Mail, MessageCircle, Printer, X } from "lucide-react";
import { amountInWordsNu } from "../lib/amount-in-words";
import {
  BILLING_MODE_LABEL,
  canIssueTaxInvoice,
  folioTotals,
  nightsBetween,
  stayBillingMode,
  useFrontOfficeStore,
  type FolioLine,
  type FolioStream,
  type Stay,
} from "../lib/front-office-store";
import { useExtrasStore } from "../lib/extras-store";
import { useSettingsStore } from "../lib/settings-store";
import { peekNextFolioNo, peekNextInvoiceNo } from "../lib/doc-numbers";

type PaperKind = "tax" | "proforma" | "folio";
type PaperSize = "a4" | "thermal";

const KIND_LABEL: Record<PaperKind, string> = {
  tax: "Tax invoice",
  proforma: "Proforma",
  folio: "Folio",
};

const KIND_TITLE: Record<PaperKind, string> = {
  tax: "INVOICE",
  proforma: "PROFORMA",
  folio: "FOLIO",
};

function money(n: number) {
  return `Nu. ${n.toLocaleString("en-BT", { maximumFractionDigits: 0 })}`;
}

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

function draftDocNo(stay: Stay, kind: PaperKind) {
  if (kind === "folio") {
    if (stay.folioNo) return stay.folioNo;
    return `${peekNextFolioNo()} · draft`;
  }
  if (kind === "proforma") {
    const base = stay.folioNo ?? peekNextFolioNo();
    return `${base.replace("FN", "PRF")} · draft`;
  }
  if (stay.taxInvoiceNo) return stay.taxInvoiceNo;
  return `${peekNextInvoiceNo()} · draft`;
}

function lineDesc(line: FolioLine): string {
  if (line.description?.trim()) return line.description.trim();
  if (line.kind === "room") return "Room charge";
  if (line.kind === "fb") return "F&B";
  if (line.kind === "payment") return "Payment";
  if (line.kind === "adjustment") return "Adjustment";
  return line.kind;
}

export function InvoiceModal({
  open,
  stay,
  stream = "master",
  onClose,
  autoPrint = false,
}: {
  open: boolean;
  stay: Stay | null;
  stream?: FolioStream;
  onClose: () => void;
  /** Fire window.print once after open (partner portal Print action). */
  autoPrint?: boolean;
}) {
  const hotelName = useSettingsStore((s) => s.hotelName);
  const ensureFolioNo = useFrontOfficeStore((s) => s.ensureFolioNo);
  const dzongkhag = useSettingsStore((s) => s.dzongkhag);
  const tpn = useSettingsStore((s) => s.tpn);
  const tradeLicense = useSettingsStore((s) => s.tradeLicense);
  const scRate = useSettingsStore((s) => s.scRate);
  const bstRate = useSettingsStore((s) => s.bstRate);
  const scEnabled = useSettingsStore((s) => s.scEnabled);
  const bstEnabled = useSettingsStore((s) => s.bstEnabled);
  const mbobMerchantId = useSettingsStore((s) => s.mbobMerchantId);
  const mbobQrNote = useSettingsStore((s) => s.mbobQrNote);
  const bnbAccountName = useSettingsStore((s) => s.bnbAccountName);
  const bnbAccountNo = useSettingsStore((s) => s.bnbAccountNo);
  const issueStayTaxInvoice = useExtrasStore((s) => s.issueStayTaxInvoice);
  const peekGaplessDocNo = useExtrasStore((s) => s.peekGaplessDocNo);
  const isPhone = useIsPhone();
  const reduceMotion = useReducedMotion();
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<PaperKind>("folio");
  const [size, setSize] = useState<PaperSize>("a4");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sendOpen, setSendOpen] = useState(false);

  function setLiquidPoint(
    el: HTMLElement | null,
    clientX: number,
    clientY: number,
  ) {
    if (!el || reduceMotion) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const mx = ((clientX - r.left) / r.width) * 100;
    const my = ((clientY - r.top) / r.height) * 100;
    el.style.setProperty("--lm-mx", `${mx.toFixed(1)}%`);
    el.style.setProperty("--lm-my", `${my.toFixed(1)}%`);
  }

  function onLiquidPointer(e: ReactPointerEvent<HTMLElement>) {
    setLiquidPoint(e.currentTarget, e.clientX, e.clientY);
  }

  function onStageScroll(e: React.UIEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const t = e.currentTarget;
    const max = Math.max(1, t.scrollHeight - t.clientHeight);
    const deg = (t.scrollTop / max) * 360;
    const flow = `${deg.toFixed(1)}deg`;
    chromeRef.current?.style.setProperty("--lm-flow", flow);
    dockRef.current?.style.setProperty("--lm-flow", flow);
    const my = 18 + (t.scrollTop / max) * 64;
    chromeRef.current?.style.setProperty("--lm-my", `${my.toFixed(1)}%`);
  }

  const activeStay = stay;
  const billingMode = activeStay ? stayBillingMode(activeStay) : "standard";
  const taxGate = activeStay ? canIssueTaxInvoice(activeStay) : null;
  const taxIssued = Boolean(activeStay?.taxInvoiceNo);

  useEffect(() => {
    if (!open || !activeStay) return;
    if (taxIssued) setKind("tax");
    else if (billingMode !== "standard") setKind("folio");
    else setKind("folio");
  }, [open, activeStay?.id, billingMode, taxIssued]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !autoPrint || !activeStay) return;
    const t = window.setTimeout(() => {
      try {
        if (!activeStay.folioNo) {
          const res = useFrontOfficeStore
            .getState()
            .ensureFolioNo(activeStay.id);
          if (!res.ok) {
            console.error("[invoice] autoPrint ensureFolioNo", res.error);
            toast.error(res.error);
            return;
          }
        }
        window.print();
      } catch (err) {
        console.error("[invoice] autoPrint", err);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [open, autoPrint, activeStay?.id]);

  const totals = useMemo(
    () => (activeStay ? folioTotals(activeStay, stream) : null),
    [activeStay, stream],
  );
  const lines = useMemo(
    () =>
      activeStay
        ? activeStay.folioLines
            .filter((l) => !l.voided && l.stream === stream)
            .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
        : [],
    [activeStay, stream],
  );

  if (!open || !activeStay || !totals) return null;
  const paper: Stay = activeStay;

  const chargeLines = lines.filter((l) => l.kind !== "payment");
  const paymentLines = lines.filter((l) => l.kind === "payment");
  const agentBill =
    paper.source === "agent" && Boolean(paper.agencyName?.trim());
  const nextFiscalHint = peekGaplessDocNo(agentBill ? "PSBN" : "INV");
  const number =
    kind === "tax" && taxIssued
      ? paper.taxInvoiceNo!
      : kind === "tax" && !taxIssued
        ? `${nextFiscalHint} · not issued`
        : draftDocNo(paper, kind);

  function allocateFolioIfNeeded(): boolean {
    if (kind !== "folio" && kind !== "proforma") return true;
    if (paper.folioNo) return true;
    const res = ensureFolioNo(paper.id);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    return true;
  }
  const issueDate = shortDate(
    paper.taxInvoiceAt ?? new Date().toISOString().slice(0, 10),
  );
  const nights = nightsBetween(paper.checkIn, paper.checkOut);
  const scPct = scEnabled ? Math.round(scRate * 100) : 0;
  const gstPct = bstEnabled ? Math.round(bstRate * 100) : 0;
  const billTo =
    paper.source === "agent" && paper.agencyName
      ? paper.agencyName
      : paper.guestName;
  const guestDetail = [
    paper.source === "agent" ? paper.guestName : null,
    paper.nationality || null,
    paper.passportOrCid ? `ID ${paper.passportOrCid}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const roomLabel = paper.roomNumber ?? "—";
  const adults = paper.adults ?? 1;
  const children = paper.children ?? 0;
  const emailValue = email || paper.guestEmail || "";
  const whatsappValue = whatsapp || paper.guestPhone || "";

  function run(label: string, fn: () => boolean | void) {
    start(() => {
      try {
        const ok = fn();
        if (ok === false) return;
        const stayNow =
          useFrontOfficeStore.getState().stays.find((s) => s.id === paper.id) ??
          paper;
        const shown =
          kind === "tax" && stayNow.taxInvoiceNo
            ? stayNow.taxInvoiceNo
            : (stayNow.folioNo ?? number);
        toast.success(`${label} · ${shown}`);
      } catch (err) {
        console.error("[invoice]", label, err);
        toast.error(err instanceof Error ? err.message : `${label} failed`);
      }
    });
  }

  function issueTax() {
    start(() => {
      const res = issueStayTaxInvoice(paper.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tax invoice created · ${res.doc.docNo}`, {
        description:
          res.doc.kind === "PSBN"
            ? "Agent city ledger · gapless PSBN"
            : "Guest fiscal INV · gapless sequence",
      });
      setKind("tax");
    });
  }

  const printBlocked = kind === "tax" && !taxIssued;
  const billingHint =
    billingMode === "complementary"
      ? "Complementary / FOC — folio & proforma only. Tax invoice blocked."
      : billingMode === "no_bill"
        ? "No-bill stay — operational paper only. Tax invoice blocked."
        : taxIssued
          ? `Fiscal tax invoice on file · ${activeStay.taxInvoiceNo}`
          : "Tax invoice optional — create only when this stay needs a fiscal bill.";

  function kindPills(layoutKey: string) {
    return (
      <div className="hos-liquid-segment">
        {(["folio", "proforma", "tax"] as PaperKind[]).map((k) => {
          const taxBlocked =
            k === "tax" && billingMode !== "standard" && !taxIssued;
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              disabled={taxBlocked}
              data-active={active}
              title={
                taxBlocked
                  ? taxGate && !taxGate.ok
                    ? taxGate.error
                    : "Tax invoice not allowed for this billing mode"
                  : undefined
              }
              onClick={() => setKind(k)}
              className="hos-liquid-segment__btn disabled:cursor-not-allowed disabled:opacity-35"
            >
              {active && !reduceMotion ? (
                <motion.span
                  layoutId={`fiscal-kind-${layoutKey}`}
                  className="hos-liquid-segment__pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : active ? (
                <span className="hos-liquid-segment__pill" />
              ) : null}
              <span className="relative z-[1]">
                {KIND_LABEL[k]}
                {k === "tax" && taxIssued ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function sizePills(layoutKey: string) {
    return (
      <div className="hos-liquid-segment">
        {(["a4", "thermal"] as PaperSize[]).map((s) => {
          const active = size === s;
          return (
            <button
              key={s}
              type="button"
              data-active={active}
              data-tone="brass"
              onClick={() => setSize(s)}
              className="hos-liquid-segment__btn"
            >
              {active && !reduceMotion ? (
                <motion.span
                  layoutId={`fiscal-size-${layoutKey}`}
                  className="hos-liquid-segment__pill hos-liquid-segment__pill--brass"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : active ? (
                <span className="hos-liquid-segment__pill hos-liquid-segment__pill--brass" />
              ) : null}
              <span className="relative z-[1] uppercase tracking-wide">
                {s === "a4" ? "A4" : "80mm"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (typeof document === "undefined") return null;

  /* Always body — StaySheet modal host is pointer-events-none and broke scroll/clicks. */
  return createPortal(
    <div
      className={`pointer-events-auto fixed inset-0 z-[200] flex items-stretch justify-center bg-[rgba(15,23,42,0.55)] backdrop-blur-sm ${
        isPhone ? "p-0" : "p-3 sm:p-5"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Fiscal paper"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={`flex w-full flex-col overflow-hidden ${
          isPhone
            ? "hos-liquid-shell h-dvh max-h-dvh max-w-none rounded-none border-0"
            : "hos-surface-glass h-[min(96vh,920px)] max-h-[96vh] max-w-[1180px] rounded-xl border border-[color-mix(in_srgb,var(--hos-ink)_10%,transparent)] shadow-[0_40px_100px_-40px_rgba(15,23,42,0.55)]"
        }`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          ref={chromeRef}
          className={`hos-invoice-chrome-hide hos-liquid-metal shrink-0 ${
            isPhone
              ? "rounded-b-[1.35rem] pt-[max(0.65rem,env(safe-area-inset-top))]"
              : "border-b border-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)]"
          }`}
          onPointerMove={onLiquidPointer}
        >
          <header
            className={`flex items-start justify-between gap-3 ${
              isPhone ? "px-4 pb-2" : "px-5 py-4"
            }`}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.2em] text-[#3a4454]/uppercase">
                Fiscal paper
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold tracking-tight text-[#10141c] sm:text-lg">
                {activeStay.guestName}
                <span className="text-[#4a5568]"> · Rm {roomLabel}</span>
              </h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[#4a5568]">
                {number} · {money(totals.balance)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`hos-btn-tactile flex shrink-0 items-center justify-center border border-white/45 bg-white/35 text-[#1a2230] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md ${
                isPhone
                  ? "size-11 rounded-full"
                  : "min-h-11 rounded-lg px-3 text-sm font-semibold"
              }`}
            >
              {isPhone ? <X className="size-5" strokeWidth={2.25} /> : "Close"}
            </button>
          </header>

          <div className="space-y-2.5 px-4 pb-3.5 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="hos-liquid-chip">
                {BILLING_MODE_LABEL[billingMode]}
              </span>
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#3a4454]">
                {billingHint}
              </p>
            </div>
            {kindPills("mobile")}
            {sizePills("mobile")}
            {kind === "tax" && !taxIssued ? (
              <Button
                className="hos-btn-ink w-full justify-center"
                disabled={pending || !taxGate?.ok}
                onClick={issueTax}
              >
                Create tax invoice
                <span className="ml-1.5 font-mono text-[10px] opacity-80">
                  {nextFiscalHint}
                </span>
              </Button>
            ) : null}
            {kind === "tax" && taxIssued ? (
              <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-center text-[11px] font-semibold text-emerald-900">
                Issued · {activeStay.taxInvoiceNo}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hos-invoice-chrome-hide hos-scrollbar-slim hidden min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain border-r border-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)] p-4 lg:flex">
            <section>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--hos-ink-3)] uppercase">
                Document
              </p>
              <div className="mb-2 rounded-[12px] border border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-ink)_3%,transparent)] px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  Billing · {BILLING_MODE_LABEL[billingMode]}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--hos-ink-2)]">
                  {billingHint}
                </p>
              </div>
              {kindPills("desk")}
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--hos-ink-3)] uppercase">
                Paper
              </p>
              {sizePills("desk")}
            </section>

            <section className="space-y-2">
              <FieldInput
                label="Email"
                value={emailValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                placeholder="guest@example.com"
              />
              <FieldInput
                label="WhatsApp"
                value={whatsappValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setWhatsapp(e.target.value)
                }
                placeholder="+975…"
              />
            </section>

            <div className="mt-auto space-y-2 border-t border-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)] pt-4">
              {kind === "tax" && !taxIssued ? (
                <Button
                  className="hos-btn-ink w-full justify-center"
                  disabled={pending || !taxGate?.ok}
                  onClick={issueTax}
                >
                  Create tax invoice
                  <span className="ml-1.5 font-mono text-[10px] opacity-80">
                    {nextFiscalHint}
                  </span>
                </Button>
              ) : null}
              {kind === "tax" && taxIssued ? (
                <p className="rounded-[10px] bg-[rgba(16,185,129,0.12)] px-2.5 py-2 text-center text-[11px] font-semibold text-[var(--hos-emerald)]">
                  Issued · {activeStay.taxInvoiceNo}
                </p>
              ) : null}
              <Button
                className="w-full justify-center"
                disabled={pending || printBlocked}
                title={
                  printBlocked
                    ? "Create the tax invoice before printing fiscal paper"
                    : undefined
                }
                onClick={() =>
                  run("Printed", () => {
                    if (!allocateFolioIfNeeded()) return false;
                    window.print();
                  })
                }
              >
                {printBlocked ? "Print (create INV first)" : "Print"}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                disabled={pending || !emailValue.trim() || printBlocked}
                onClick={() =>
                  run("Emailed", () => {
                    if (!allocateFolioIfNeeded()) return false;
                    /* Delivery adapter staged — audit toast only until mailer wired. */
                  })
                }
              >
                Email PDF
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-center"
                disabled={pending || !whatsappValue.trim() || printBlocked}
                onClick={() =>
                  run("WhatsApp queued", () => {
                    if (!allocateFolioIfNeeded()) return false;
                    /* WhatsApp adapter staged — audit toast only until messenger wired. */
                  })
                }
              >
                WhatsApp
              </Button>
            </div>
          </aside>

          <div
            className={`hos-fiscal-stage hos-scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain ${
              isPhone ? "p-3 pb-28" : "p-4 sm:p-6"
            }`}
            onScroll={onStageScroll}
          >
            {size === "a4" ? (
              <article
                id="hos-print-root"
                className={`hos-fiscal-sheet mx-auto flex w-full max-w-[210mm] flex-col bg-white text-[#1a1410] shadow-[0_16px_40px_rgba(26,20,16,0.16)] ${
                  isPhone
                    ? "min-h-0 px-4 py-4 text-[12px]"
                    : "min-h-[297mm] px-[12mm] py-[8mm]"
                }`}
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
                      {KIND_LABEL[kind]}
                    </p>
                    <h3 className="mt-0.5 text-[18px] font-semibold tracking-wide text-[#1a1410]">
                      {KIND_TITLE[kind]} {number}
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
                      </tbody>
                    </table>
                  </div>
                </header>

                <p className="mt-1.5 text-[11px] leading-tight">
                  <Fact label="Guest" value={activeStay.guestName} />
                  <Fact label="Agent" value={activeStay.agencyName || "—"} />
                  <Fact label="Room" value={roomLabel} />
                  <Fact
                    label="Pax"
                    value={`${adults}A${children ? `+${children}C` : ""}`}
                  />
                  {activeStay.passportOrCid ? (
                    <Fact label="ID" value={activeStay.passportOrCid} />
                  ) : null}
                </p>

                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-sm border border-[#d8d0c6] bg-[#f7f4ef] px-2.5 py-2">
                    <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
                      Bill to
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-[#1a1410]">
                      {billTo}
                    </p>
                    {guestDetail ? (
                      <p className="mt-0.5 text-[11px] text-[#3a322c]">{guestDetail}</p>
                    ) : null}
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
                        activeStay.roomNumber ? `Room ${activeStay.roomNumber}` : null,
                        `${shortDate(activeStay.checkIn)} → ${shortDate(activeStay.checkOut)}`,
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
                          Folio
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
                          Rate
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
                            No lines on this folio yet.
                          </td>
                        </tr>
                      ) : (
                        chargeLines.map((line) => {
                          const isRoom = line.kind === "room";
                          return (
                            <tr key={line.id} className="align-top">
                              <td className="border border-[#1a1410] px-1.5 py-1 font-medium">
                                {roomLabel}
                              </td>
                              <td className="border border-[#1a1410] px-1.5 py-1">
                                {lineDesc(line)}
                              </td>
                              <td className="border border-[#1a1410] px-1.5 py-1 whitespace-nowrap">
                                {isRoom ? shortDate(activeStay.checkIn) : "—"}
                              </td>
                              <td className="border border-[#1a1410] px-1.5 py-1 whitespace-nowrap">
                                {isRoom ? shortDate(activeStay.checkOut) : "—"}
                              </td>
                              <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums">
                                {isRoom ? nights || "—" : "—"}
                              </td>
                              <td className="border border-[#1a1410] px-1.5 py-1 text-right tabular-nums">
                                {isRoom && nights > 0
                                  ? moneyPlain(Math.round(line.netAmount / nights))
                                  : moneyPlain(line.netAmount)}
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
                          <p className="font-semibold text-[#1a1410]">
                            Tax summary
                          </p>
                          <p className="mt-1">
                            Service charge {scPct}% and Bhutan Sales Tax (GST){" "}
                            {gstPct}% applied on taxable room / F&amp;B nets where
                            enabled in property fiscal settings.
                          </p>
                          {kind === "proforma" ? (
                            <p className="mt-1 italic text-[#6e2c2c]">
                              This is a proforma — not a fiscal tax invoice.
                            </p>
                          ) : null}
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
                  <span className="mt-0.5 block uppercase">
                    {amountInWordsNu(
                      totals.balance > 0 ? totals.balance : totals.charged,
                    )}
                  </span>
                </p>

                <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-[11px]">
                  <SignLine title="Bill prepared by" name="Front desk" />
                  <SignLine title="Authorized signatory" name={hotelName} />
                  <SignLine title="Guest acknowledgement" name="" />
                  <div>
                    <p className="font-semibold">For, {hotelName}</p>
                  </div>
                </section>

                {(bnbAccountNo || mbobMerchantId) && kind !== "proforma" ? (
                  <section className="mt-4 border border-[#d8d0c6] bg-[#f7f4ef] px-3 py-2.5 text-[11px]">
                    <p className="text-[9.5px] font-bold tracking-[0.16em] text-[#5c534c] uppercase">
                      Payment
                    </p>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {bnbAccountNo ? (
                        <p>
                          <span className="text-[#5c534c]">BnB · </span>
                          <span className="font-medium">
                            {bnbAccountName || hotelName}
                          </span>
                          <span className="ml-1 tabular-nums">{bnbAccountNo}</span>
                        </p>
                      ) : null}
                      {mbobMerchantId ? (
                        <p>
                          <span className="text-[#5c534c]">mBoB · </span>
                          <span className="font-medium tabular-nums">
                            {mbobMerchantId}
                          </span>
                          {mbobQrNote ? (
                            <span className="ml-1 text-[#5c534c]">{mbobQrNote}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <footer className="mt-auto border-t border-[#d8d0c6] pt-2 text-center text-[9px] tracking-wide text-[#5c534c]">
                  {kind === "tax"
                    ? taxIssued
                      ? "This is a computer-generated tax invoice. Gapless fiscal sequence — do not alter."
                      : "Preview only — press Create tax invoice to allocate a gapless fiscal number."
                    : kind === "folio"
                      ? "Working folio — settle before checkout. Tax invoice is optional and created separately when required."
                      : "Proforma for estimation only — not valid for GST / DRC submission."}
                </footer>
              </article>
            ) : (
              <article
                id="hos-print-root"
                className="hos-invoice-thermal mx-auto bg-white px-3 py-4 font-mono text-[11px] leading-relaxed text-[#1a1410] shadow-[0_12px_32px_rgba(26,20,16,0.18)]"
              >
                <p className="text-center text-sm font-bold tracking-wide">
                  {hotelName.toUpperCase()}
                </p>
                <p className="text-center text-[10px] text-[#5c534c]">
                  {dzongkhag} · TPN {tpn || "—"}
                </p>
                <p className="mt-2 text-center text-[10px] font-bold tracking-[0.14em] text-[#6e2c2c] uppercase">
                  {KIND_LABEL[kind]}
                </p>
                <p className="text-center font-semibold">{number}</p>
                <div className="my-2 border-t border-dashed border-[#1a1410]" />
                <Row k="Guest" v={activeStay.guestName} />
                <Row k="Room" v={roomLabel} />
                <Row
                  k="Stay"
                  v={`${activeStay.checkIn} → ${activeStay.checkOut}`}
                />
                <div className="my-2 border-t border-dashed border-[#1a1410]" />
                {chargeLines.map((l) => (
                  <div key={l.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{lineDesc(l)}</span>
                    <span className="shrink-0 tabular-nums">
                      {moneyPlain(l.totalAmount)}
                    </span>
                  </div>
                ))}
                <div className="my-2 border-t border-dashed border-[#1a1410]" />
                <Row k={`SC ${scPct}%`} v={moneyPlain(totals.sc)} />
                <Row k={`GST ${gstPct}%`} v={moneyPlain(totals.bst)} />
                <Row k="TOTAL" v={moneyPlain(totals.charged)} bold />
                <Row k="Paid" v={moneyPlain(totals.paid)} />
                <Row k="Balance" v={moneyPlain(totals.balance)} bold />
                <div className="my-2 border-t border-dashed border-[#1a1410]" />
                <p className="text-center text-[9px] text-[#5c534c]">
                  Thank you · {hotelName}
                </p>
              </article>
            )}
          </div>
        </div>

        <div
          ref={dockRef}
          className="hos-invoice-chrome-hide hos-liquid-metal hos-liquid-dock shrink-0 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
          onPointerMove={onLiquidPointer}
        >
          {sendOpen ? (
            <div className="mb-2 grid gap-2 rounded-2xl border border-white/20 bg-white/10 p-2.5 backdrop-blur-md">
              <FieldInput
                label="Email"
                value={emailValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                placeholder="guest@example.com"
              />
              <FieldInput
                label="WhatsApp"
                value={whatsappValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setWhatsapp(e.target.value)
                }
                placeholder="+975…"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={pending || printBlocked}
              title={
                printBlocked
                  ? "Create the tax invoice before printing"
                  : undefined
              }
              onClick={() =>
                run("Printed", () => {
                  if (!allocateFolioIfNeeded()) return false;
                  window.print();
                })
              }
              className="hos-btn-tactile hos-liquid-dock-btn hos-liquid-dock-btn--primary disabled:opacity-40"
            >
              <Printer className="size-4" strokeWidth={2.25} />
              Print
            </button>
            <button
              type="button"
              disabled={pending || printBlocked}
              onClick={() => {
                if (!sendOpen) {
                  setSendOpen(true);
                  return;
                }
                if (!emailValue.trim()) {
                  toast.error("Add an email address first");
                  return;
                }
                run("Emailed", () => {
                  if (!allocateFolioIfNeeded()) return false;
                  /* Delivery adapter staged — audit toast only until mailer wired. */
                });
              }}
              className="hos-btn-tactile hos-liquid-dock-btn disabled:opacity-40"
            >
              <Mail className="size-4" strokeWidth={2.25} />
              {sendOpen ? "Send email" : "Email"}
            </button>
            <button
              type="button"
              disabled={pending || printBlocked}
              onClick={() => {
                if (!sendOpen) {
                  setSendOpen(true);
                  return;
                }
                if (!whatsappValue.trim()) {
                  toast.error("Add a WhatsApp number first");
                  return;
                }
                run("WhatsApp queued", () => {
                  if (!allocateFolioIfNeeded()) return false;
                  /* WhatsApp adapter staged — audit toast only until messenger wired. */
                });
              }}
              className="hos-btn-tactile hos-liquid-dock-btn disabled:opacity-40"
            >
              <MessageCircle className="size-4" strokeWidth={2.25} />
              {sendOpen ? "Send WA" : "WhatsApp"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
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

function Row({
  k,
  v,
  bold,
}: {
  k: string;
  v: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
