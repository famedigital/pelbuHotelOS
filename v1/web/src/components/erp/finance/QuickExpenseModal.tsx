"use client";

import { useState, useActionState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlusCircle, DollarSign, Tag, CreditCard, FileText, CheckCircle2 } from "lucide-react";
import { createExpense, type ErpFinanceState } from "@/app/actions/erp-finance";
import { useActionToast } from "@/hooks/use-action-toast";

interface QuickExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const initial: ErpFinanceState = { ok: false };

export function QuickExpenseModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickExpenseModalProps) {
  const [state, action, pending] = useActionState(createExpense, initial);
  useActionToast(state, { successMessage: "✓ Expense recorded to books" });

  useEffect(() => {
    if (state.ok) {
      onOpenChange(false);
      onSuccess?.();
    }
  }, [state.ok, onOpenChange, onSuccess]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sovereign-glass border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              15-Second Entry
            </span>
            <span className="text-xs text-muted-foreground">• Cash &amp; Bank Ledger</span>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-amber-500" />
            <span>Record Hotel Expense</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Instantly log kitchen produce, gas cylinders, diesel, maintenance, or staff cash payouts.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4 mt-2">
          <input type="hidden" name="expense_date" value={today} />
          <input type="hidden" name="gst_btn" value="0" />

          {/* Amount Nu */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Amount (Nu.)
            </label>
            <input
              type="number"
              name="amount_btn"
              step="0.01"
              min="1"
              required
              placeholder="e.g. 450"
              className="w-full h-12 px-4 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input text-lg font-black font-mono tracking-tight outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
          </div>

          {/* Category & Payment Method 2-Col */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" /> Category
              </label>
              <select
                name="category"
                defaultValue="fb_produce"
                required
                className="w-full h-11 px-3 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="fb_produce">🥬 Kitchen Produce / Veg</option>
                <option value="fb_lpg">🔥 LPG Gas Cylinder</option>
                <option value="fb_beverage">☕ Bar &amp; Beverages</option>
                <option value="supplies">🧼 Housekeeping Supplies</option>
                <option value="utilities">⚡ Electricity / Water</option>
                <option value="maintenance">🔧 Room Maintenance</option>
                <option value="payroll">👥 Staff Cash Advance</option>
                <option value="other">📦 Other Operations</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> Paid From
              </label>
              <select
                name="payment_method"
                defaultValue="cash"
                required
                className="w-full h-11 px-3 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="cash">💵 Cash Drawer</option>
                <option value="bank">🏦 Bank (mBoB / BoB)</option>
                <option value="card">💳 Card</option>
              </select>
            </div>
          </div>

          {/* Description & Vendor */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Description &amp; Vendor
            </label>
            <input
              type="text"
              name="description"
              required
              placeholder="e.g. Chili, potatoes, and red rice from Centenary Farmers Market"
              className="w-full h-10 px-3 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Optional Vendor */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Vendor / Supplier (Optional)
            </label>
            <input
              type="text"
              name="vendor"
              placeholder="e.g. Olakha Meat Shop / Druk Gas"
              className="w-full h-9 px-3 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <DialogFooter className="pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{pending ? "Saving to Books…" : "Save Expense to Books"}</span>
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
