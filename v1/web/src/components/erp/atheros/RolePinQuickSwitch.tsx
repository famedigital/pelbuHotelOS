"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRoundIcon, ShieldAlertIcon, UserCheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

interface RolePinQuickSwitchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRole?: string;
  onRoleSwitched?: (newRole: "owner" | "desk" | "hk", actorName: string) => void;
}

export function RolePinQuickSwitch({
  open,
  onOpenChange,
  currentRole = "desk",
  onRoleSwitched,
}: RolePinQuickSwitchProps) {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const verifyPin = async (inputPin: string) => {
    setIsVerifying(true);

    // Mock rapid 0.5s local verification or server-side PIN lookup
    setTimeout(() => {
      setIsVerifying(false);

      if (inputPin === "1111" || inputPin === "9999") {
        toast.success("Owner Profile Unlocked 👑", {
          description: "Full P&L, wholesale margins & financial telemetry active.",
        });
        onRoleSwitched?.("owner", "General Manager");
        onOpenChange(false);
        setPin("");
      } else if (inputPin === "2222") {
        toast.success("Front Desk Agent Profile Active", {
          description: "Operations, check-in, folio management enabled.",
        });
        onRoleSwitched?.("desk", "Front Desk Agent");
        onOpenChange(false);
        setPin("");
      } else if (inputPin === "3333") {
        toast.success("Housekeeping Profile Active 🧹", {
          description: "Room cleaning status & maintenance mode.",
        });
        onRoleSwitched?.("hk", "Housekeeping Lead");
        onOpenChange(false);
        setPin("");
      } else {
        toast.error("Invalid 4-Digit PIN", {
          description: "PIN does not match any registered staff role.",
        });
        setPin("");
      }
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sovereign-glass sm:max-w-[340px] p-6 border-none">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-[#1a4332]/10 dark:bg-[#d97706]/15 text-[#1a4332] dark:text-[#d97706]">
            <KeyRoundIcon className="size-6" />
          </div>
          <DialogTitle className="text-lg font-bold">Quick Role Switch</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter 4-digit staff PIN for instant 0.5s profile transition.
          </p>
        </DialogHeader>

        {/* 4-PIN Indicators */}
        <div className="my-4 flex items-center justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => {
            const hasValue = pin.length > idx;
            return (
              <div
                key={idx}
                className={cn(
                  "size-4 rounded-full border-2 transition-all",
                  hasValue
                    ? "border-[#1a4332] bg-[#1a4332] dark:border-[#d97706] dark:bg-[#d97706] scale-110"
                    : "border-black/20 dark:border-white/20 bg-transparent"
                )}
              />
            );
          })}
        </div>

        {/* Tactile 3D Number Pad */}
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              disabled={isVerifying}
              onClick={() => handleKeyPress(n)}
              className="touch-press flex h-12 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 text-lg font-bold text-foreground shadow-xs hover:bg-white/70 dark:hover:bg-white/10 active:scale-95 transition-all"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            className="touch-press flex h-12 items-center justify-center rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleKeyPress("0")}
            className="touch-press flex h-12 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 text-lg font-bold text-foreground shadow-xs hover:bg-white/70 dark:hover:bg-white/10 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="touch-press flex h-12 items-center justify-center rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
          >
            ⌫
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
