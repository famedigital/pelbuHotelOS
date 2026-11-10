import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  Building2,
  Filter,
  Package,
  Receipt,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  GlassTiltCard,
  ModuleFrame,
  MorphTabs,
} from "@hos-v2/ui";
import { canIssueCashAdvance } from "@hos-v2/domain";
import { formatNu } from "../lib/front-office-store";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import { useExtrasStore } from "../lib/extras-store";
import {
  PURCHASE_CATEGORIES,
  PURCHASE_PAYMENT_MODES,
  purchaseCategoryLabel,
  suggestPurchaseJournalNo,
  useFiscalStore,
  type PurchaseCategoryId,
  type PurchaseLine,
  type PurchasePaymentMode,
} from "../lib/fiscal-store";
import { useInventoryStore } from "../lib/inventory-store";

type FilterTab = "all" | "credit" | "paid";
type MainTab = "bills" | "cfm" | "drawer";

const CFM_RUNNER_FLOAT_BTN = 5000;

function todayThimphu(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
}

function fieldClass() {
  return "hos-input w-full !rounded-xl !border-[var(--hos-line)] !bg-[var(--hos-cell)] !px-3 !py-2.5 !text-[13px] text-[var(--hos-ink)] outline-none focus:!border-[var(--hos-primary)]";
}

/** Dual-axis ledger scroller — vertical + horizontal with sticky header. */
function LedgerScroll({
  children,
  minWidth = "920px",
  maxHeight = "min(52vh, 520px)",
}: {
  children: ReactNode;
  minWidth?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className="hos-scrollbar-slim overflow-auto rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] [transform:translateZ(0)]"
      style={{ maxHeight }}
    >
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/** Expected GST rate on taxable base (Bhutan purchase categories). */
function expectedGstPct(category: PurchaseCategoryId): number {
  switch (category) {
    case "veg_dairy":
    case "utilities":
    case "payroll":
      return 0;
    case "meat":
    case "grocery":
    case "bar":
    case "gas_lpg":
    case "repairs":
    case "office":
      return 5;
    default:
      return 5;
  }
}

function daysBetween(ymd: string, refYmd: string): number {
  const a = new Date(`${ymd}T12:00:00`).getTime();
  const b = new Date(`${refYmd}T12:00:00`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

function agingBucket(days: number): string {
  if (days <= 30) return "0–30d";
  if (days <= 60) return "31–60d";
  if (days <= 90) return "61–90d";
  return "90d+";
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const [, start] = useTransition();
  const purchases = useFiscalStore((s) => s.purchases);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const advances = useEnterpriseOpsStore((s) => s.advances);
  const movements = useEnterpriseOpsStore((s) => s.movements);
  const shift = useEnterpriseOpsStore((s) => s.shift);
  const issueAdvanceRemote = useEnterpriseOpsStore((s) => s.issueAdvanceRemote);
  const reconcileAdvanceRemote = useEnterpriseOpsStore(
    (s) => s.reconcileAdvanceRemote,
  );
  const postBillWithCashLaw = useEnterpriseOpsStore((s) => s.postBillWithCashLaw);
  const tillShifts = useExtrasStore((s) => s.tillShifts);

  const [mainTab, setMainTab] = useState<MainTab>("bills");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCategory, setFilterCategory] = useState<PurchaseCategoryId | "all">("all");

  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(todayThimphu());
  const [supplierName, setSupplierName] = useState("");
  const [category, setCategory] = useState<PurchaseCategoryId>("veg_dairy");
  const [taxableBtn, setTaxableBtn] = useState("");
  const [gstBtn, setGstBtn] = useState("");
  const [nonTaxableBtn, setNonTaxableBtn] = useState("");
  const [paymentMode, setPaymentMode] =
    useState<PurchasePaymentMode>("credit");
  const [advanceId, setAdvanceId] = useState<string>("");
  const [journalNo, setJournalNo] = useState(() =>
    suggestPurchaseJournalNo(
      useFiscalStore.getState().purchases,
      todayThimphu(),
    ),
  );
  const skus = useInventoryStore((s) => s.skus);
  const [grnLines, setGrnLines] = useState<PurchaseLine[]>([]);

  const [advAmount, setAdvAmount] = useState(() =>
    String(
      Math.min(
        CFM_RUNNER_FLOAT_BTN,
        Math.max(0, useFiscalStore.getState().tillBalance),
      ),
    ),
  );
  const [advName, setAdvName] = useState("CFM runner");
  const [recAdvanceId, setRecAdvanceId] = useState("");
  const [recSpent, setRecSpent] = useState("");
  const [recChange, setRecChange] = useState("");

  const taxable = Math.max(0, Number(taxableBtn) || 0);
  const gst = Math.max(0, Number(gstBtn) || 0);
  const nonTax = Math.max(0, Number(nonTaxableBtn) || 0);
  const grandTotal = Math.round((taxable + gst + nonTax) * 100) / 100;
  const gstExpectedPct = expectedGstPct(category);
  const expectedGstAmt =
    gstExpectedPct > 0 ? Math.round(taxable * (gstExpectedPct / 100) * 100) / 100 : 0;
  const gstVariance =
    gstExpectedPct > 0 && taxable > 0 ? Math.abs(gst - expectedGstAmt) > 0.02 : false;

  const openAdvances = advances.filter((a) => a.status === "open");
  const monthPrefix = billDate.slice(0, 7);
  const shiftOpenedMs = new Date(shift.openedAt).getTime();

  const advancePreview = useMemo(() => {
    const amt = Number(advAmount) || 0;
    return canIssueCashAdvance({ amountBtn: amt, tillBalanceBtn: tillBalance });
  }, [advAmount, tillBalance]);

  const prefillFloat = useMemo(() => {
    const cap = Math.min(CFM_RUNNER_FLOAT_BTN, tillBalance);
    return cap > 0 ? Math.round(cap) : CFM_RUNNER_FLOAT_BTN;
  }, [tillBalance]);

  const supplierChips = useMemo(() => {
    const set = new Set<string>();
    for (const p of purchases) {
      if (p.supplierName.trim()) set.add(p.supplierName.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [purchases]);

  const apAging = useMemo(() => {
    const today = todayThimphu();
    const byVendor = new Map<
      string,
      { total: number; buckets: Record<string, number> }
    >();
    for (const p of purchases.filter((x) => x.paymentMode === "credit")) {
      const name = p.supplierName.trim() || "Unknown";
      const days = daysBetween(p.billDate, today);
      const bucket = agingBucket(days);
      const row = byVendor.get(name) ?? {
        total: 0,
        buckets: { "0–30d": 0, "31–60d": 0, "61–90d": 0, "90d+": 0 },
      };
      row.total += p.grandTotalBtn;
      row.buckets[bucket] = (row.buckets[bucket] ?? 0) + p.grandTotalBtn;
      byVendor.set(name, row);
    }
    return [...byVendor.entries()]
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [purchases]);

  const kpis = useMemo(() => {
    const monthBills = purchases.filter((p) =>
      p.billDate.startsWith(monthPrefix || todayThimphu().slice(0, 7)),
    );
    const apOpen = purchases
      .filter((p) => p.paymentMode === "credit")
      .reduce((s, p) => s + p.grandTotalBtn, 0);
    const paidCashBank = purchases
      .filter((p) => p.paymentMode === "cash" || p.paymentMode === "bank")
      .reduce((s, p) => s + p.grandTotalBtn, 0);
    return {
      monthCount: monthBills.length,
      monthTotal: monthBills.reduce((s, p) => s + p.grandTotalBtn, 0),
      apOpen,
      paidCashBank,
      openAdvances: openAdvances.length,
    };
  }, [purchases, monthPrefix, openAdvances.length]);

  const rows = useMemo(() => {
    let list = purchases;
    if (filter === "credit") list = list.filter((p) => p.paymentMode === "credit");
    else if (filter === "paid")
      list = list.filter((p) => p.paymentMode !== "credit");
    if (filterCategory !== "all")
      list = list.filter((p) => p.category === filterCategory);
    if (filterSupplier.trim())
      list = list.filter((p) =>
        p.supplierName.toLowerCase().includes(filterSupplier.trim().toLowerCase()),
      );
    if (filterDateFrom)
      list = list.filter((p) => p.billDate >= filterDateFrom);
    if (filterDateTo) list = list.filter((p) => p.billDate <= filterDateTo);
    return list;
  }, [
    purchases,
    filter,
    filterCategory,
    filterSupplier,
    filterDateFrom,
    filterDateTo,
  ]);

  const isAdvancePastShift = (issuedAt: string, status: string) => {
    if (status !== "open") return false;
    const issuedMs = new Date(issuedAt).getTime();
    if (issuedMs < shiftOpenedMs) return true;
    const lastClosed = tillShifts.find((t) => t.closedAt);
    if (lastClosed?.closedAt) {
      const closedMs = new Date(lastClosed.closedAt).getTime();
      if (issuedMs < closedMs) return true;
    }
    return false;
  };

  const resetForm = () => {
    const nextDate = todayThimphu();
    setBillNo("");
    setBillDate(nextDate);
    setSupplierName("");
    setCategory("veg_dairy");
    setTaxableBtn("");
    setGstBtn("");
    setNonTaxableBtn("");
    setPaymentMode("credit");
    setAdvanceId("");
    setGrnLines([]);
    setJournalNo(
      suggestPurchaseJournalNo(useFiscalStore.getState().purchases, nextDate),
    );
  };

  const applyExpectedGst = () => {
    if (gstExpectedPct <= 0) {
      setGstBtn("0");
      return;
    }
    setGstBtn(String(expectedGstAmt));
  };

  const cashWithoutAdvance =
    paymentMode === "cash" && (!advanceId || !openAdvances.some((a) => a.id === advanceId));

  return (
    <ModuleFrame
      title="Purchases"
      description="Centenary market float · AP journal · till-synced cash bills"
      eyebrow="Procurement · Bhutan GST"
      actions={
        <>
          <Button
            size="sm"
            className="hos-btn-tactile gap-1.5 !rounded-full"
            onClick={() => navigate("/stock")}
          >
            <Package className="size-3.5" aria-hidden />
            Stock
          </Button>
          <Button
            size="sm"
            className="hos-btn-tactile gap-1.5 !rounded-full"
            onClick={() => navigate("/bank-recon")}
          >
            <ArrowRightLeft className="size-3.5" aria-hidden />
            Bank recon
          </Button>
        </>
      }
    >
    <div className="flex min-w-0 flex-col gap-4">
      <GlassPanel className="relative overflow-hidden p-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(17,17,17,0.04)] via-transparent to-[rgba(245,158,11,0.08)]" />
        <div className="relative mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#111] text-white shadow-[0_10px_24px_-12px_#111]">
              <ShoppingBag className="size-4" strokeWidth={2} />
            </span>
            <div>
              <strong className="block text-sm font-extrabold tracking-tight text-[var(--hos-ink)]">
                Purchase ledger cockpit
              </strong>
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                Supplier bills · CFM float · dual-axis ledgers
              </p>
            </div>
          </div>
          <Badge tone="teal" className="border border-[var(--hos-line)]">
            Till {formatNu(tillBalance)}
          </Badge>
        </div>
        <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "Bills this month", value: String(kpis.monthCount), meta: monthPrefix || "—" },
            { label: "Month total", value: formatNu(kpis.monthTotal), meta: "Posted" },
            { label: "AP open", value: formatNu(kpis.apOpen), meta: "Credit" },
            { label: "Open advances", value: String(kpis.openAdvances), meta: "CFM" },
            { label: "Live till", value: formatNu(tillBalance), meta: "Drawer" },
          ].map((k) => (
            <div
              key={k.label}
              className="hos-luxury-card flex min-h-[72px] flex-col justify-center px-3 py-2.5"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                {k.label}
              </span>
              <strong className="mt-1 font-mono text-[1.05rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]">
                {k.value}
              </strong>
              <span className="text-[10px] text-[var(--hos-ink-3)]">{k.meta}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      <MorphTabs
        glowId="purchaseMainGlow"
        value={mainTab}
        onChange={setMainTab}
        size="md"
        items={[
          { id: "bills", label: "Supplier bills" },
          { id: "cfm", label: "CFM advances", count: openAdvances.length },
          { id: "drawer", label: "Drawer movements" },
        ]}
      />

      {mainTab === "bills" ? (
        <>
          <MorphTabs
            glowId="purchaseFilterGlow"
            value={filter}
            onChange={setFilter}
            size="sm"
            items={[
              { id: "all", label: "All bills" },
              { id: "credit", label: "Open credit" },
              { id: "paid", label: "Paid" },
            ]}
          />

          <GlassPanel className="flex flex-col gap-3 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold tracking-tight text-[var(--hos-ink)]">
              <Filter className="size-3.5 text-[var(--hos-primary)]" aria-hidden />
              Ledger filters
              <span className="ml-auto font-mono text-[10px] font-semibold tabular-nums text-[var(--hos-ink-3)]">
                {rows.length} row{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <label className="grid gap-1 text-[10px] font-medium">
                From
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className={fieldClass()}
                />
              </label>
              <label className="grid gap-1 text-[10px] font-medium">
                To
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className={fieldClass()}
                />
              </label>
              <label className="grid gap-1 text-[10px] font-medium lg:col-span-2">
                Supplier contains
                <input
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  placeholder="Centenary, vendor…"
                  className={fieldClass()}
                />
              </label>
              <label className="grid gap-1 text-[10px] font-medium">
                Category
                <select
                  value={filterCategory}
                  onChange={(e) =>
                    setFilterCategory(e.target.value as PurchaseCategoryId | "all")
                  }
                  className={fieldClass()}
                >
                  <option value="all">All categories</option>
                  {PURCHASE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {supplierChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {supplierChips.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setFilterSupplier((cur) => (cur === s ? "" : s))
                    }
                    className={`hos-btn-tactile rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                      filterSupplier === s
                        ? "border-transparent bg-[#111] text-white shadow-[0_8px_18px_-10px_#111]"
                        : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
                    }`}
                  >
                    <Store className="mr-1 inline size-3 opacity-70" aria-hidden />
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </GlassPanel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
            <GlassTiltCard className="hos-luxury-card flex flex-col gap-3 !p-4" glowColor="brass">
              <strong className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
                <Receipt className="size-4 text-[var(--hos-brass-ink)]" aria-hidden />
                Bill capture assistant
              </strong>

              {cashWithoutAdvance ? (
                <div className="flex gap-2 rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[var(--hos-ruby)]">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Cash payment requires an open CFM advance — issue float first or pick advance.
                </div>
              ) : null}

              <div className="hos-cell rounded-xl border border-[var(--hos-line)] px-3 py-2 text-[11px]">
                <span className="text-[var(--hos-ink-3)]">Category GST hint · </span>
                <strong className="text-[var(--hos-ink)]">
                  {purchaseCategoryLabel(category)} → {gstExpectedPct}% on taxable
                </strong>
                {gstVariance ? (
                  <span className="ml-2 text-[var(--hos-ruby)]">
                    (entered GST differs from {formatNu(expectedGstAmt)})
                  </span>
                ) : null}
                {gstExpectedPct > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 h-6 px-2 text-[10px]"
                    onClick={applyExpectedGst}
                  >
                    Apply {gstExpectedPct}%
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[11px] font-medium">
                  Bill no
                  <input
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    className={fieldClass()}
                    placeholder="INV / supplier ref"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-medium">
                  Date
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => {
                      setBillDate(e.target.value);
                      setJournalNo(
                        suggestPurchaseJournalNo(purchases, e.target.value),
                      );
                    }}
                    className={fieldClass()}
                  />
                </label>
              </div>

              <label className="grid gap-1 text-[11px] font-medium">
                Supplier name
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className={fieldClass()}
                  placeholder="Vendor / shop"
                />
              </label>

              <label className="grid gap-1 text-[11px] font-medium">
                Category
                <select
                  value={category}
                  onChange={(e) => {
                    const id = e.target.value as PurchaseCategoryId;
                    setCategory(id);
                    const pct = expectedGstPct(id);
                    if (pct > 0 && taxable > 0) {
                      setGstBtn(
                        String(
                          Math.round(taxable * (pct / 100) * 100) / 100,
                        ),
                      );
                    } else if (pct === 0) setGstBtn("0");
                  }}
                  className={fieldClass()}
                >
                  {PURCHASE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-[11px] font-medium">
                  Taxable
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={taxableBtn}
                    onChange={(e) => {
                      setTaxableBtn(e.target.value);
                      const t = Math.max(0, Number(e.target.value) || 0);
                      if (gstExpectedPct > 0) {
                        setGstBtn(
                          String(
                            Math.round(t * (gstExpectedPct / 100) * 100) / 100,
                          ),
                        );
                      }
                    }}
                    className={fieldClass()}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-medium">
                  GST
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={gstBtn}
                    onChange={(e) => setGstBtn(e.target.value)}
                    className={fieldClass()}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-medium">
                  Non-tax
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={nonTaxableBtn}
                    onChange={(e) => setNonTaxableBtn(e.target.value)}
                    className={fieldClass()}
                  />
                </label>
              </div>

              <div className="hos-luxury-card rounded-2xl p-3.5">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                  G. total
                </div>
                <strong className="font-mono text-[1.35rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]">
                  {formatNu(grandTotal)}
                </strong>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[11px] font-medium">
                  Payment mode
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      const m = e.target.value as PurchasePaymentMode;
                      setPaymentMode(m);
                      if (m !== "cash") setAdvanceId("");
                    }}
                    className={fieldClass()}
                  >
                    {PURCHASE_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m === "credit"
                          ? "Credit (AP)"
                          : m[0]!.toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-medium">
                  Jrno
                  <input
                    value={journalNo}
                    onChange={(e) => setJournalNo(e.target.value)}
                    className={`${fieldClass()} font-mono`}
                  />
                </label>
              </div>

              {paymentMode === "cash" ? (
                <label className="grid gap-1 text-[11px] font-medium">
                  Linked CFM advance (required)
                  <select
                    value={advanceId}
                    onChange={(e) => setAdvanceId(e.target.value)}
                    className={fieldClass()}
                  >
                    <option value="">Select open advance…</option>
                    {openAdvances.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.issuedToName} · {formatNu(a.amountBtn)} ·{" "}
                        {a.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <strong className="text-xs text-[var(--hos-ink)]">
                    GRN stock lines (optional)
                  </strong>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const first = skus[0];
                      if (!first) return;
                      setGrnLines((rows) => [
                        ...rows,
                        {
                          skuId: first.id,
                          name: first.name,
                          qty: 1,
                          uom: first.uom,
                          unitCost: 0,
                        },
                      ]);
                    }}
                  >
                    Add line
                  </Button>
                </div>
                {grnLines.length === 0 ? (
                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                    Add SKUs to bump Stock on-hand when this bill saves.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {grnLines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_70px_70px_auto] gap-1">
                        <select
                          value={line.skuId}
                          onChange={(e) => {
                            const sku = skus.find((s) => s.id === e.target.value);
                            if (!sku) return;
                            setGrnLines((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      skuId: sku.id,
                                      name: sku.name,
                                      uom: sku.uom,
                                    }
                                  : r,
                              ),
                            );
                          }}
                          className={fieldClass()}
                        >
                          {skus.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} · {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.qty}
                          onChange={(e) =>
                            setGrnLines((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? { ...r, qty: Number(e.target.value) || 0 }
                                  : r,
                              ),
                            )
                          }
                          className={fieldClass()}
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          min={0}
                          value={line.unitCost}
                          onChange={(e) =>
                            setGrnLines((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      unitCost: Number(e.target.value) || 0,
                                    }
                                  : r,
                              ),
                            )
                          }
                          className={fieldClass()}
                          placeholder="Cost"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setGrnLines((rows) => rows.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="hos-btn-ink hos-btn-spring w-full !rounded-2xl"
                disabled={cashWithoutAdvance}
                onClick={() => {
                  start(() => {
                    const res = postBillWithCashLaw({
                      billNo,
                      billDate,
                      supplierName,
                      category,
                      taxableBtn: taxable,
                      gstBtn: gst,
                      nonTaxableBtn: nonTax,
                      paymentMode,
                      advanceId: paymentMode === "cash" ? advanceId || null : null,
                      journalNo,
                      lines: grnLines,
                    });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Purchase bill saved", {
                      description: `${res.bill.billNo} · ${formatNu(res.bill.grandTotalBtn)} · ${res.bill.journalNo}${
                        grnLines.length ? ` · ${grnLines.length} stock line(s)` : ""
                      }`,
                    });
                    resetForm();
                  });
                }}
              >
                Save purchase bill
              </Button>
            </GlassTiltCard>

            <div className="flex flex-col gap-4">
              <PurchaseBillsTable
                rows={rows}
                empty={
                  <EmptyState
                    title="No bills in this view"
                    description="Adjust filters or post a supplier bill."
                  />
                }
              />

              {apAging.length > 0 ? (
                <GlassTiltCard className="hos-luxury-card !p-4" glowColor="brand">
                  <strong className="mb-3 flex items-center gap-2 text-sm font-extrabold tracking-tight">
                    <Building2 className="size-4 text-[var(--hos-primary)]" aria-hidden />
                    AP aging by vendor
                  </strong>
                  <LedgerScroll minWidth="720px" maxHeight="min(40vh, 360px)">
                    <table className="hos-data w-full text-left text-xs">
                      <thead>
                        <tr className="sticky top-0 z-[1] border-b border-[var(--hos-line)] bg-[var(--hos-cell)] text-[10px] uppercase text-[var(--hos-ink-3)] shadow-[0_1px_0_var(--hos-line)]">
                          <th className="px-3 py-2.5">Vendor</th>
                          <th className="px-3 py-2.5 text-right">Open AP</th>
                          <th className="px-3 py-2.5 text-right">0–30d</th>
                          <th className="px-3 py-2.5 text-right">31–60d</th>
                          <th className="px-3 py-2.5 text-right">61–90d</th>
                          <th className="px-3 py-2.5 text-right">90d+</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--hos-line)]">
                        {apAging.map((v) => (
                          <tr key={v.vendor}>
                            <td className="px-3 py-2.5 font-semibold">{v.vendor}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                              {formatNu(v.total)}
                            </td>
                            {(["0–30d", "31–60d", "61–90d", "90d+"] as const).map(
                              (b) => (
                                <td
                                  key={b}
                                  className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                                    b === "90d+" && v.buckets[b]
                                      ? "text-[var(--hos-ruby)]"
                                      : "text-[var(--hos-ink-2)]"
                                  }`}
                                >
                                  {v.buckets[b] ? formatNu(v.buckets[b]) : "—"}
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </LedgerScroll>
                </GlassTiltCard>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {mainTab === "cfm" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassTiltCard className="hos-luxury-card flex flex-col gap-3 !p-4" glowColor="emerald">
            <strong className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
              <Wallet className="size-4 text-[var(--hos-emerald)]" aria-hidden />
              CFM copilot · issue advance
            </strong>
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Prefilled runner float · till preview before draw
            </p>
            <div className="hos-cell grid grid-cols-2 gap-2 rounded-xl p-3 text-[11px]">
              <div>
                <div className="text-[var(--hos-ink-3)]">Live till</div>
                <strong className="tabular-nums">{formatNu(tillBalance)}</strong>
              </div>
              <div>
                <div className="text-[var(--hos-ink-3)]">After issue</div>
                <strong
                  className={`tabular-nums ${
                    advancePreview.ok ? "text-[var(--hos-emerald)]" : "text-[var(--hos-ruby)]"
                  }`}
                >
                  {advancePreview.ok
                    ? formatNu(advancePreview.tillAfterBtn)
                    : advancePreview.error}
                </strong>
              </div>
            </div>
            <label className="grid gap-1 text-[11px] font-medium">
              Issued to
              <input
                value={advName}
                onChange={(e) => setAdvName(e.target.value)}
                className={fieldClass()}
              />
            </label>
            <label className="grid gap-1 text-[11px] font-medium">
              Amount (Nu) · prefill {formatNu(prefillFloat)}
              <input
                type="number"
                min={1}
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                className={fieldClass()}
              />
            </label>
            <Button
              className="hos-btn-ink hos-btn-spring !rounded-2xl"
              disabled={!advancePreview.ok}
              onClick={() => {
                start(async () => {
                  const res = await issueAdvanceRemote({
                    amountBtn: Number(advAmount) || 0,
                    issuedToName: advName.trim() || "CFM runner",
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Advance issued", {
                    description: `${formatNu(res.advance.amountBtn)} · till now ${formatNu(useFiscalStore.getState().tillBalance)} · ${res.persistence === "postgres" ? "saved" : "local demo"}`,
                  });
                  setRecAdvanceId(res.advance.id);
                });
              }}
            >
              Issue from till
            </Button>
          </GlassTiltCard>

          <GlassTiltCard className="hos-luxury-card flex flex-col gap-3 !p-4" glowColor="brand">
            <strong className="text-sm font-extrabold tracking-tight">
              Reconcile advance
            </strong>
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Law: spent + change returned = issued amount
            </p>
            <label className="grid gap-1 text-[11px] font-medium">
              Advance
              <select
                value={recAdvanceId}
                onChange={(e) => setRecAdvanceId(e.target.value)}
                className={fieldClass()}
              >
                <option value="">Select…</option>
                {openAdvances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.issuedToName} · {formatNu(a.amountBtn)} (spent{" "}
                    {formatNu(a.spentBtn)})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-medium">
                Spent
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={recSpent}
                  onChange={(e) => setRecSpent(e.target.value)}
                  className={fieldClass()}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-medium">
                Change returned
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={recChange}
                  onChange={(e) => setRecChange(e.target.value)}
                  className={fieldClass()}
                />
              </label>
            </div>
            <Button
              className="hos-btn-tactile !rounded-2xl"
              onClick={() => {
                start(async () => {
                  const res = await reconcileAdvanceRemote({
                    advanceId: recAdvanceId,
                    spentBtn: Number(recSpent) || 0,
                    changeReturnedBtn: Number(recChange) || 0,
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Advance reconciled", {
                    description: `Till credit ${formatNu(res.tillCreditBtn)} · ${res.persistence === "postgres" ? "saved" : "local demo"}`,
                  });
                  setRecSpent("");
                  setRecChange("");
                });
              }}
            >
              Reconcile &amp; return change
            </Button>
          </GlassTiltCard>

          <div className="min-w-0 lg:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--hos-ink)]">
              <Banknote className="size-3.5 text-[var(--hos-primary)]" aria-hidden />
              Advance register
            </div>
            {advances.length === 0 ? (
              <div className="hos-luxury-card p-6">
                <EmptyState
                  title="No advances yet"
                  description="Issue CFM float before cash market bills."
                />
              </div>
            ) : (
              <LedgerScroll minWidth="860px" maxHeight="min(48vh, 440px)">
                <table className="hos-data w-full text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-[var(--hos-line)] bg-[var(--hos-cell)] text-[10px] uppercase text-[var(--hos-ink-3)] shadow-[0_1px_0_var(--hos-line)]">
                      <th className="px-3 py-2.5">To</th>
                      <th className="px-3 py-2.5">Issued</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5 text-right">Spent</th>
                      <th className="px-3 py-2.5 text-right">Change</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Shift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {advances.map((a) => {
                      const past = isAdvancePastShift(a.issuedAt, a.status);
                      return (
                        <tr key={a.id}>
                          <td className="px-3 py-2.5 font-semibold">
                            {a.issuedToName}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                            {new Date(a.issuedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatNu(a.amountBtn)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatNu(a.spentBtn)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatNu(a.changeReturnedBtn)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={a.status === "open" ? "vip" : "success"}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            {past ? (
                              <Badge tone="danger">Past shift</Badge>
                            ) : (
                              <span className="text-[10px] text-[var(--hos-ink-3)]">
                                Current
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </LedgerScroll>
            )}
          </div>
        </div>
      ) : null}

      {mainTab === "drawer" ? (
        <GlassPanel className="hos-luxury-card !p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge tone="success">{shift.status} shift</Badge>
            <span className="text-xs text-[var(--hos-ink-3)]">
              Expected {formatNu(shift.expectedBalanceBtn)} · opened{" "}
              {new Date(shift.openedAt).toLocaleString()}
            </span>
          </div>
          {movements.length === 0 ? (
            <EmptyState
              title="No drawer movements"
              description="Movements appear when advances are issued or reconciled."
            />
          ) : (
            <LedgerScroll minWidth="640px" maxHeight="min(60vh, 560px)">
              <table className="hos-data w-full text-left text-xs">
                <thead>
                  <tr className="sticky top-0 z-[1] border-b border-[var(--hos-line)] bg-[var(--hos-cell)] text-[10px] uppercase text-[var(--hos-ink-3)] shadow-[0_1px_0_var(--hos-line)]">
                    <th className="px-3 py-2.5">When</th>
                    <th className="px-3 py-2.5">Kind</th>
                    <th className="px-3 py-2.5">Note</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                        {new Date(m.at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">{m.kind}</td>
                      <td className="px-3 py-2.5">{m.note}</td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          m.direction === "out"
                            ? "text-[var(--hos-ruby)]"
                            : "text-[var(--hos-emerald)]"
                        }`}
                      >
                        {m.direction === "out" ? "−" : "+"}
                        {formatNu(m.amountBtn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LedgerScroll>
          )}
        </GlassPanel>
      ) : null}
    </div>
    </ModuleFrame>
  );
}

function PurchaseBillsTable({
  rows,
  empty,
}: {
  rows: Array<{
    id: string;
    billNo: string;
    billDate: string;
    supplierName: string;
    category: PurchaseCategoryId;
    grandTotalBtn: number;
    paymentMode: PurchasePaymentMode;
    journalNo: string;
  }>;
  empty: ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="hos-luxury-card p-6">{empty}</div>;
  }
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--hos-ink)]">
        <Receipt className="size-3.5 text-[var(--hos-primary)]" aria-hidden />
        Supplier bill journal
        <span className="ml-auto font-mono text-[10px] text-[var(--hos-ink-3)]">
          scroll ↔ ↕
        </span>
      </div>
      <LedgerScroll minWidth="960px" maxHeight="min(56vh, 560px)">
        <table className="hos-data w-full text-left text-xs">
          <thead>
            <tr className="sticky top-0 z-[1] border-b border-[var(--hos-line)] bg-[var(--hos-cell)] text-[10px] uppercase text-[var(--hos-ink-3)] shadow-[0_1px_0_var(--hos-line)]">
              <th className="px-3 py-2.5">Bill no</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Supplier</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5 text-right">G.total</th>
              <th className="px-3 py-2.5">Pay</th>
              <th className="px-3 py-2.5">Jrno</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hos-line)]">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2.5 font-semibold">{p.billNo}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  {p.billDate}
                </td>
                <td className="px-3 py-2.5">{p.supplierName}</td>
                <td className="px-3 py-2.5">
                  <Badge tone="muted">{purchaseCategoryLabel(p.category)}</Badge>
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {formatNu(p.grandTotalBtn)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={p.paymentMode === "credit" ? "vip" : "success"}>
                    {p.paymentMode}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px]">{p.journalNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LedgerScroll>
    </div>
  );
}
