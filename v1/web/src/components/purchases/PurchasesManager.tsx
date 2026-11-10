"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
  ShoppingCart,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Filter,
  Calendar,
  Layers,
  ArrowDownRight,
  TrendingDown,
  Store,
  Flame,
  Zap,
  Users,
  Wrench,
  Search,
} from "lucide-react";
import {
  NeoGlassCard,
  TactileButton,
  OdometerTicker,
} from "@/components/ui/neo-spatial";
import {
  useRamEngine,
  getExpectedCashTillBtn,
  type EngineExpense,
} from "@hotel-os/engine";
import { toast } from "sonner";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { refreshV2DeskEngine } from "@/lib/v2/rehydrate-engine";
import { readV2DeskToken } from "@/lib/v2/desk-api";

const EXPENSE_CATEGORIES = [
  { id: "veg_dairy", label: "Centenary Veg & Dairy", icon: Store, tone: "text-emerald-400 bg-emerald-500/10" },
  { id: "meat", label: "Meat & Poultry", icon: Store, tone: "text-rose-400 bg-rose-500/10" },
  { id: "grocery", label: "Dry Grocery & Store", icon: ShoppingCart, tone: "text-amber-400 bg-amber-500/10" },
  { id: "bar", label: "Bar Stock & Beverages", icon: Store, tone: "text-indigo-400 bg-indigo-500/10" },
  { id: "gas_lpg", label: "Commercial LPG Gas", icon: Flame, tone: "text-orange-400 bg-orange-500/10" },
  { id: "utilities", label: "Electricity & Internet", icon: Zap, tone: "text-sky-400 bg-sky-500/10" },
  { id: "payroll", label: "Salaries & 10% Tip Pool", icon: Users, tone: "text-purple-400 bg-purple-500/10" },
  { id: "repairs", label: "Repairs & Maintenance", icon: Wrench, tone: "text-slate-400 bg-slate-500/10" },
  { id: "office", label: "Guest Amenities & Office", icon: Layers, tone: "text-teal-400 bg-teal-500/10" },
] as const;

type ApiExpenseRow = {
  id: string;
  description: string;
  amount_btn: number;
  category: string;
  vendor: string | null;
  expense_date: string;
  payment_method: string | null;
};

type FinanceHub = {
  monthStart: string;
  expenseTotalBtn: number;
  paymentsInBtn: number;
  vendors: Array<Record<string, unknown>>;
};

export type PurchasesManagerProps = {
  /** `api` — `/v2/purchases` posts through POST /v1/finance/expenses and lists from API. */
  variant?: "ram" | "api";
};

export const PurchasesManager: React.FC<PurchasesManagerProps> = ({
  variant = "ram",
}) => {
  const { cashTill, expenses, recordExpense, staffId } = useRamEngine();

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPaidVia, setFilterPaidVia] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [apiExpenses, setApiExpenses] = useState<ApiExpenseRow[]>([]);
  const [hub, setHub] = useState<FinanceHub | null>(null);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);
  const [pendingApi, startApi] = useTransition();

  // New Expense Form State
  const [newCategory, setNewCategory] = useState<EngineExpense["category"]>("veg_dairy");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newPaidVia, setNewPaidVia] = useState<EngineExpense["paidVia"]>("front_till");
  const [newSupplier, setNewSupplier] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadApiLedger = useCallback(() => {
    if (variant !== "api") return;
    if (!readV2DeskToken()) {
      setApiLoadError("Sign in on /v2 with staff PIN to load expenses.");
      return;
    }
    startApi(async () => {
      try {
        setApiLoadError(null);
        const [hubRes, list] = await Promise.all([
          deskFetchJson<FinanceHub>("/v1/finance/hub"),
          deskFetchJson<{ expenses: ApiExpenseRow[] }>("/v1/finance/expenses"),
        ]);
        setHub(hubRes);
        setApiExpenses(list.expenses ?? []);
      } catch (err) {
        console.error("[PurchasesManager] API ledger load", err);
        const msg =
          err instanceof DeskApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setApiLoadError(msg);
        toast.error(msg);
      }
    });
  }, [variant]);

  useEffect(() => {
    loadApiLedger();
  }, [loadApiLedger]);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount);
    if (!newDescription.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Please enter a valid description and positive amount.");
      return;
    }

    if (variant === "api") {
      startApi(async () => {
        try {
          if (!readV2DeskToken()) {
            toast.error("Sign in on /v2 first.");
            return;
          }
          const paymentMethod =
            newPaidVia === "front_till"
              ? "cash"
              : newPaidVia === "mbob_wire"
                ? "mbob"
                : newPaidVia === "cheque"
                  ? "cheque"
                  : "credit";
          await deskFetchJson("/v1/finance/expenses", {
            method: "POST",
            body: JSON.stringify({
              description: newDescription.trim(),
              amountBtn: parsedAmount,
              category: newCategory,
              vendor: newSupplier.trim() || undefined,
              paymentMethod,
              idempotencyKey: newIdempotencyKey(),
            }),
          });
          toast.success(`Expense recorded — Nu. ${parsedAmount.toFixed(2)}`);
          try {
            await refreshV2DeskEngine();
          } catch (err) {
            console.error("[PurchasesManager] snapshot refresh", err);
          }
          loadApiLedger();
          setNewDescription("");
          setNewAmount("");
          setNewSupplier("");
          setShowLogModal(false);
        } catch (err) {
          console.error("[PurchasesManager] create expense", err);
          toast.error(
            err instanceof DeskApiError ? err.message : err instanceof Error ? err.message : String(err),
          );
        }
      });
      return;
    }

    const expenseObj: EngineExpense = {
      id: `exp_${Date.now()}`,
      category: newCategory,
      description: newDescription.trim(),
      amountBtn: parsedAmount,
      paidVia: newPaidVia,
      supplierName: newSupplier.trim() || undefined,
      recordedByStaffId: staffId || "unknown_staff",
      timestamp: new Date().toISOString(),
    };

    void recordExpense(expenseObj);

    if (newPaidVia === "front_till") {
      showToast(`Logged Nu. ${parsedAmount.toFixed(2)} — till delta in RAM (use /v2 for API)`);
    } else {
      showToast(`Logged Nu. ${parsedAmount.toFixed(2)} (${newPaidVia})`);
    }

    setNewDescription("");
    setNewAmount("");
    setNewSupplier("");
    setShowLogModal(false);
  };

  const expectedCashBtn = getExpectedCashTillBtn(cashTill);
  const signedInApi = variant === "api" && Boolean(readV2DeskToken());

  const filteredExpenses = expenses.filter((exp) => {
    if (filterCategory !== "all" && exp.category !== filterCategory) return false;
    if (filterPaidVia !== "all" && exp.paidVia !== filterPaidVia) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = exp.description.toLowerCase().includes(q);
      const matchSupplier = (exp.supplierName || "").toLowerCase().includes(q);
      if (!matchDesc && !matchSupplier) return false;
    }
    return true;
  });

  const totalExpenseFiltered = filteredExpenses.reduce((sum, e) => sum + e.amountBtn, 0);

  const filteredApiExpenses = apiExpenses.filter((exp) => {
    if (filterCategory !== "all" && exp.category !== filterCategory) return false;
    const paidMap =
      exp.payment_method === "front_till"
        ? "front_till"
        : exp.payment_method === "mbob_wire"
          ? "mbob_wire"
          : exp.payment_method === "cheque"
            ? "cheque"
            : "credit_unpaid";
    if (filterPaidVia !== "all" && paidMap !== filterPaidVia) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = exp.description.toLowerCase().includes(q);
      const matchVendor = (exp.vendor || "").toLowerCase().includes(q);
      if (!matchDesc && !matchVendor) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden font-sans">
      {/* 1. Header Toolbar */}
      <header className="border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Purchases & Expenses Ledger</h1>
              <p className="text-xs text-slate-400">
                Centenary Farmers Market, Utilities, LPG Gas & Automatic Cash Till Deduction
              </p>
            </div>
          </div>
        </div>

        {/* Live Cash Till Indicator & Log Action */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              {variant === "api" ? "Till (snapshot + API month)" : "Front Desk Till Balance"}
            </p>
            <OdometerTicker value={expectedCashBtn} prefix="Nu. " className="text-base font-bold text-emerald-400" />
            {variant === "api" && hub ? (
              <span className="text-[10px] text-slate-400 block -mt-0.5 font-mono">
                Month expenses (API): Nu. {hub.expenseTotalBtn.toFixed(2)}
              </span>
            ) : (
              <span className="text-[10px] text-rose-400 block -mt-0.5 font-mono">
                - Nu. {cashTill.pettyCashOutflowBtn.toLocaleString()} Payouts Today
              </span>
            )}
          </div>

          {variant === "api" ? (
            <TactileButton
              variant="secondary"
              size="md"
              disabled={!signedInApi || pendingApi}
              onClick={() => loadApiLedger()}
            >
              Reload ledger
            </TactileButton>
          ) : null}

          <TactileButton
            variant="amber"
            size="md"
            disabled={variant === "api" && !signedInApi}
            onClick={() => setShowLogModal(true)}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Log Expense
          </TactileButton>
        </div>
      </header>

      {/* 2. Main Ledger & Filter Surface */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Quick KPI Stat Strip */}
        {variant === "api" && apiLoadError ? (
          <p className="text-xs text-rose-400 border border-rose-500/20 rounded-xl p-3">{apiLoadError}</p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NeoGlassCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Expenses Recorded</p>
              <OdometerTicker
                value={
                  variant === "api" ? filteredApiExpenses.reduce((s, r) => s + Number(r.amount_btn), 0) : totalExpenseFiltered
                }
                prefix="Nu. "
                className="text-2xl font-bold text-white"
              />
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </NeoGlassCard>

          <NeoGlassCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {variant === "api" ? "Cash payments in (month, API)" : "Paid from Front Desk Till"}
              </p>
              <OdometerTicker
                value={variant === "api" ? (hub?.paymentsInBtn ?? 0) : cashTill.pettyCashOutflowBtn}
                prefix="Nu. "
                className="text-2xl font-bold text-rose-400"
              />
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </NeoGlassCard>

          <NeoGlassCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {variant === "api" ? "Recon" : "Cash Till Discrepancy"}
              </p>
              <p className="text-2xl font-bold text-slate-300 font-mono text-sm leading-snug">
                {variant === "api"
                  ? hub
                    ? `Month from ${hub.monthStart} · reconcile in Innora finance`
                    : "—"
                  : "Nu. 0.00 (RAM demo)"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </NeoGlassCard>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search vendor or item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={filterPaidVia}
              onChange={(e) => setFilterPaidVia(e.target.value)}
              className="bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="all">All Payment Channels</option>
              <option value="front_till">Front Desk Cash Till</option>
              <option value="mbob_wire">mBoB Bank Transfer</option>
              <option value="cheque">Bank Cheque</option>
              <option value="credit_unpaid">Credit (Unpaid Dues)</option>
            </select>
          </div>

          <TactileButton
            variant="secondary"
            size="sm"
            onClick={() =>
              showToast(variant === "api" ? "Export not wired — copy from table or use Innora reports." : "Export — use API variant on /v2/purchases")
            }
            icon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Export DRC Expense CSV
          </TactileButton>
        </div>

        {/* High-Density Spreadsheet Table */}
        <NeoGlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Paid Via</th>
                  <th className="py-3 px-4 text-right">Amount (BTN)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {variant === "api" && !signedInApi ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                      Sign in on /v2 to load property expenses from the API.
                    </td>
                  </tr>
                ) : variant === "api" && filteredApiExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                      No expenses returned for this property (or list still loading).
                    </td>
                  </tr>
                ) : variant === "api" ? (
                  filteredApiExpenses.map((exp) => {
                    const catObj = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                    const paidVia =
                      exp.payment_method === "front_till"
                        ? "front_till"
                        : exp.payment_method === "mbob_wire"
                          ? "mbob_wire"
                          : exp.payment_method === "cheque"
                            ? "cheque"
                            : "credit_unpaid";
                    return (
                      <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {new Date(exp.expense_date).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              catObj?.tone || "text-slate-300 bg-slate-800"
                            }`}
                          >
                            <span>{catObj?.label || exp.category}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{exp.description}</td>
                        <td className="py-3 px-4 text-slate-300">{exp.vendor || "—"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                              paidVia === "front_till"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : paidVia === "credit_unpaid"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}
                          >
                            {paidVia === "front_till"
                              ? "Front Till"
                              : paidVia === "mbob_wire"
                                ? "mBoB / Wire"
                                : paidVia === "cheque"
                                  ? "Cheque"
                                  : "Credit"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          Nu. {Number(exp.amount_btn).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Posted</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                      No expenses logged yet. Tap &ldquo;Log Expense&rdquo; above.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const catObj = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                    return (
                      <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {new Date(exp.timestamp).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              catObj?.tone || "text-slate-300 bg-slate-800"
                            }`}
                          >
                            <span>{catObj?.label || exp.category}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{exp.description}</td>
                        <td className="py-3 px-4 text-slate-300">{exp.supplierName || "—"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                              exp.paidVia === "front_till"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : exp.paidVia === "credit_unpaid"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}
                          >
                            {exp.paidVia === "front_till"
                              ? "Front Till Cash"
                              : exp.paidVia === "mbob_wire"
                              ? "mBoB Wire"
                              : exp.paidVia === "cheque"
                              ? "Bank Cheque"
                              : "Credit Bill (Unpaid)"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          Nu. {exp.amountBtn.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <span>RAM only</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </NeoGlassCard>
      </div>

      {/* 3. Log Expense Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-950 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <span>Record Hospitality Purchase</span>
              </h2>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Expense Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as EngineExpense["category"])}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Item Description / Specifics</label>
                <input
                  type="text"
                  placeholder="e.g. 25kg Potatoes, 30 blocks Datshi, 2x LPG Gas"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Total Amount (BTN / Nu.)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="2450.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-mono font-bold focus:outline-none focus:border-indigo-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={newPaidVia}
                    onChange={(e) => setNewPaidVia(e.target.value as EngineExpense["paidVia"])}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="front_till">Front Desk Till (Cash)</option>
                    <option value="mbob_wire">mBoB Bank Wire</option>
                    <option value="cheque">Bank Cheque</option>
                    <option value="credit_unpaid">Credit (Pay Later)</option>
                  </select>
                </div>
              </div>

              {newPaidVia === "front_till" && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    {variant === "api"
                      ? `Posts via record_expense_and_till_deduct — Nu. ${parseFloat(newAmount || "0").toFixed(2)} deducted from shift till in Postgres.`
                      : `RAM only — use /v2/purchases (API) for real till deduct.`}
                  </span>
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Supplier / Vendor Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Centenary Market Shed #14, Druk Petroleum"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <TactileButton variant="secondary" size="md" onClick={() => setShowLogModal(false)}>
                  Cancel
                </TactileButton>
                <TactileButton variant="amber" size="md" type="submit" disabled={variant === "api" && pendingApi}>
                  {variant === "api" ? "Record via API" : "Record (RAM)"}
                </TactileButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating 0ms Toast Confirmation */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(16,185,129,0.4)] text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
