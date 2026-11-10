"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  RefreshCw,
  Users,
  Truck,
  FileCheck2,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGuestBtn } from "@/lib/pricing";
import type { HotelAccountSnapshot } from "@/lib/accounting/hotel-account";
import type { ClosedDay } from "@/lib/finance/closed-day";
import {
  AutoMatchButton,
  UnmatchedTxnRow,
  type FinanceExpenseOption,
  type FinancePaymentOption,
  type UnmatchedBankTxn,
} from "@/components/erp/FinanceForms";
import { QuickExpenseModal } from "./QuickExpenseModal";

interface ExecutiveFinanceCockpitProps {
  snapshot: HotelAccountSnapshot;
  closedDay: ClosedDay;
  unmatched: UnmatchedBankTxn[];
  payments: FinancePaymentOption[];
  expenses: FinanceExpenseOption[];
  todayDate: string;
}

export function ExecutiveFinanceCockpit({
  snapshot,
  closedDay,
  unmatched,
  payments,
  expenses,
  todayDate,
}: ExecutiveFinanceCockpitProps) {
  const [activeTab, setActiveTab] = useState<"receivables" | "payables" | "bank_match">("receivables");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  const vault = snapshot.vault;
  const mtd = snapshot.mtd;
  const att = snapshot.attention;

  const todayRevenue = closedDay.room + closedDay.fnb + closedDay.laundry;
  const totalReceivables = vault.arGuestBtn + vault.arAgentBtn;
  const totalPayables = vault.apBtn + vault.payrollPayableBtn;

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER - NO ACADEMIC FLUFF, PURE CLARITY */}
      <div className="p-6 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Executive Finance Cockpit
            </span>
            <span className="text-xs text-muted-foreground">• Real-Time Ledger Balance</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mt-1 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            Hotel Cash &amp; Bank Treasury
          </h1>
          <p className="text-sm text-muted-foreground">
            {todayDate} • Cash on hand, today&apos;s takings, who owes us, and 1-click bank reconciliation.
          </p>
        </div>

        {/* Action Buttons: 1-Click AutoMatch + Quick Expense + Print */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setExpenseModalOpen(true)}
            className="h-11 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Quick Expense</span>
          </button>

          {unmatched.length > 0 && <AutoMatchButton />}

          <Link
            href="/erp/finance/print"
            target="_blank"
            className="h-11 px-4 rounded-xl font-bold text-xs sovereign-glass border border-white/20 hover:bg-muted text-foreground flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Cashier Summary</span>
          </Link>
        </div>
      </div>

      {/* 2. REAL MONEY IN HAND HERO CARD (THE VAULT) */}
      <div className="p-6 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/50">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Total Liquid Cash &amp; Bank Available Today
            </span>
            <div className="text-4xl sm:text-5xl font-black text-foreground tabular-stat tracking-tight mt-1">
              Nu. {formatGuestBtn(vault.liquidBtn)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {att.unmatchedBank === 0 ? (
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Bank Matched &amp; Reconciled
              </span>
            ) : (
              <button
                onClick={() => setActiveTab("bank_match")}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 animate-pulse"
              >
                <AlertTriangle className="w-4 h-4" /> {att.unmatchedBank} Bank Lines Waiting to Match →
              </button>
            )}
          </div>
        </div>

        {/* Liquid Breakdown Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                💵 Cash Drawer
              </span>
              <span className="text-xl font-black text-foreground tabular-stat mt-0.5 block">
                Nu. {formatGuestBtn(vault.cashBtn)}
              </span>
              <span className="text-[11px] text-muted-foreground">Physical cash on property</span>
            </div>
            <Link
              href="/erp/pos"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              POS <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                🏦 Bank Operating (BoB / BNB)
              </span>
              <span className="text-xl font-black text-foreground tabular-stat mt-0.5 block">
                Nu. {formatGuestBtn(vault.bankBtn)}
              </span>
              <span className="text-[11px] text-muted-foreground">Cleared bank balance</span>
            </div>
            <Link
              href="/erp/finance/banking"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              Banking <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                💳 Card Clearing
              </span>
              <span className="text-xl font-black text-foreground tabular-stat mt-0.5 block">
                Nu. {formatGuestBtn(vault.cardClearingBtn)}
              </span>
              <span className="text-[11px] text-muted-foreground">Settled cards not yet banked</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">Settling</span>
          </div>
        </div>
      </div>

      {/* 3. TODAY'S OPERATIONAL PULSE (3 BENTO CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Money In Today */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Today&apos;s Revenue
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              Live Takings
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-stat">
              Nu. {formatGuestBtn(todayRevenue)}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              <div>Rooms: <strong>{formatGuestBtn(closedDay.room)}</strong></div>
              <div>F&amp;B: <strong>{formatGuestBtn(closedDay.fnb)}</strong></div>
              <div>Laundry: <strong>{formatGuestBtn(closedDay.laundry)}</strong></div>
            </div>
          </div>
        </div>

        {/* Expenses This Month */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Expenses (Month to Date)
            </span>
            <button
              onClick={() => setExpenseModalOpen(true)}
              className="text-xs font-semibold hover:underline text-primary"
            >
              + Add
            </button>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 tabular-stat">
              Nu. {formatGuestBtn(mtd.expensesBtn)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
              Total operational cash spent from drawer and bank.
            </p>
          </div>
        </div>

        {/* Net Operating Earnings */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Net Operational Cash
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              Receipts − Spent
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-foreground tabular-stat">
              Nu. {formatGuestBtn(mtd.netIncomeBtn)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
              Gross takings (Nu. {formatGuestBtn(mtd.receiptsBtn)}) less expenses.
            </p>
          </div>
        </div>
      </div>

      {/* 4. THREE LAZY WORKSPACES (TABS: WHO OWES US, WHO WE OWE, BANK MATCH) */}
      <div className="space-y-4">
        {/* Workspace Pill Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl sovereign-glass border border-white/20 dark:border-white/10">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("receivables")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2",
                activeTab === "receivables"
                  ? "bg-primary text-primary-foreground shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              <Users className="w-4 h-4" />
              <span>Who Owes Us (Nu. {formatGuestBtn(totalReceivables)})</span>
            </button>

            <button
              onClick={() => setActiveTab("payables")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2",
                activeTab === "payables"
                  ? "bg-rose-600 text-white shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              <Truck className="w-4 h-4" />
              <span>Who We Owe (Nu. {formatGuestBtn(totalPayables)})</span>
            </button>

            <button
              onClick={() => setActiveTab("bank_match")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2",
                activeTab === "bank_match"
                  ? "bg-emerald-600 text-white shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              <Building2 className="w-4 h-4" />
              <span>
                Bank Reconciliation {unmatched.length > 0 && `(${unmatched.length} waiting)`}
              </span>
            </button>
          </div>
        </div>

        {/* WORKSPACE 1: WHO OWES US */}
        {activeTab === "receivables" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* In-House Guests */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-bold uppercase text-muted-foreground">In-House Guests</span>
                  <span className="text-xs text-amber-500 font-bold">Unpaid Folios</span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground tabular-stat">
                    Nu. {formatGuestBtn(vault.arGuestBtn)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Room charges, room service, and incidentals due upon checkout.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40">
                <Link
                  href="/erp/bills"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Front Office Bills</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Tour Operators & Travel Agents */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-bold uppercase text-muted-foreground">B2B Travel Agents</span>
                  <span className="text-xs text-blue-500 font-bold">Credit Ledgers</span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground tabular-stat">
                    Nu. {formatGuestBtn(vault.arAgentBtn)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agreed credit terms for tour operators (e.g. Soul Trips, Karma Bhutan).
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40">
                <Link
                  href="/erp/agents/dossier"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Universal Agent Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Deposits Held */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Guest Deposits</span>
                  <span className="text-xs text-emerald-500 font-bold">Prepayments</span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground tabular-stat">
                    Nu. {formatGuestBtn(vault.depositsBtn)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Advance reservation deposits held prior to arrival check-in.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40">
                <Link
                  href="/erp/payments"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>View Advance Payments</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 2: WHO WE OWE */}
        {activeTab === "payables" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vendor Bills */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Suppliers &amp; Vendors</span>
                  <span className="text-xs text-rose-500 font-bold">Unpaid AP</span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground tabular-stat">
                    Nu. {formatGuestBtn(vault.apBtn)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Outstanding supplier bills for food ingredients, gas, and hotel supplies.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40">
                <Link
                  href="/erp/finance/vendors"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Manage Vendors &amp; Bills</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Payroll Due */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Staff Salaries</span>
                  <span className="text-xs text-amber-500 font-bold">Accrued Payroll</span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground tabular-stat">
                    Nu. {formatGuestBtn(vault.payrollPayableBtn)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Monthly staff salary accruals waiting to be marked paid.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40">
                <Link
                  href="/erp/hr/payroll"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Payroll Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Bhutan DRC GST */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Bhutan DRC GST</span>
                  <span className="text-xs text-purple-500 font-bold">Tax Position</span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground tabular-stat">
                    Nu. {formatGuestBtn(vault.gstNetBtn)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Net GST collected on room and restaurant sales for government filing.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40">
                <Link
                  href="/erp/finance/gst"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Review DRC GST Filing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 3: BANK AUTO-RECONCILIATION */}
        {activeTab === "bank_match" && (
          <div className="p-6 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-500" />
                  Bank Statement Reconciliation Queue
                </h3>
                <p className="text-xs text-muted-foreground">
                  Match statement lines from Bank of Bhutan (BoB) and BNB against hotel payments and expenses.
                </p>
              </div>

              {unmatched.length > 0 && <AutoMatchButton />}
            </div>

            {unmatched.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-foreground">All Bank Transactions Matched!</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Every bank statement hit is matched to an active payment or expense. Hotel accounts agree 100% with bank reality.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {unmatched.map((txn) => (
                  <UnmatchedTxnRow
                    key={txn.id}
                    txn={txn}
                    payments={payments}
                    expenses={expenses}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* QUICK EXPENSE MODAL */}
      <QuickExpenseModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
      />
    </div>
  );
}
