"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode, CheckCircle2, ShieldCheck, Copy, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatGuestBtn } from "@/lib/pricing";

interface QuickBhutanQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  totalBtn: number;
  bankName?: string;
  accountNumber?: string;
  accountTitle?: string;
  onConfirmPayment: () => void;
}

export function QuickBhutanQrModal({
  open,
  onOpenChange,
  orderId,
  totalBtn,
  bankName = "Bank of Bhutan (BoB)",
  accountNumber = "201001234567",
  accountTitle = "Pelbu Suites F&B Account",
  onConfirmPayment,
}: QuickBhutanQrModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Account number copied!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sovereign-glass border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl text-center space-y-4">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
            <QrCode className="w-7 h-7" />
          </div>
          <DialogTitle className="text-xl font-black text-foreground">
            Bhutan RMA Instant QR Pay
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Scan using mBoB, mPay, B-Mobile, or any RMA Bhutan National Payment Gateway app.
          </DialogDescription>
        </DialogHeader>

        {/* Amount Badge */}
        <div className="py-2 px-4 rounded-xl bg-muted/40 border border-border/50 inline-block mx-auto">
          <span className="text-xs text-muted-foreground block font-medium">Exact Amount to Transfer</span>
          <span className="text-3xl font-black text-foreground font-mono tabular-nums">
            Nu. {formatGuestBtn(totalBtn)}
          </span>
        </div>

        {/* Simulated High-Res Bhutan Standard QR Canvas */}
        <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 w-52 h-52 mx-auto flex flex-col items-center justify-center shadow-inner relative group">
          <div className="w-44 h-44 border-4 border-black p-2 flex flex-col items-center justify-between">
            <div className="flex justify-between w-full">
              <div className="w-8 h-8 bg-black border-2 border-white" />
              <div className="w-8 h-8 bg-black border-2 border-white" />
            </div>
            {/* Center RMA Icon / Seal */}
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-900 border border-black px-1.5 py-0.5 bg-yellow-400">
              RMA PAY
            </div>
            <div className="flex justify-between w-full">
              <div className="w-8 h-8 bg-black border-2 border-white" />
              <div className="w-4 h-4 bg-black" />
            </div>
          </div>
          <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
            {accountTitle}
          </span>
        </div>

        {/* Bank Details Strip */}
        <div className="p-3 rounded-xl bg-card border border-border/40 text-left text-xs space-y-1">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Bank: <strong className="text-foreground">{bankName}</strong></span>
            <button
              onClick={handleCopyAccount}
              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <Copy className="w-3 h-3" />
              <span>{copied ? "Copied!" : "Copy Acct"}</span>
            </button>
          </div>
          <div className="text-sm font-mono font-bold text-foreground tracking-wide">
            {accountNumber}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            onConfirmPayment();
            onOpenChange(false);
          }}
          className="w-full h-12 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>Payment Verified &amp; Received</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
