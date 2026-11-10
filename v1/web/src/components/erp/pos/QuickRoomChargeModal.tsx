"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, BedDouble, UserCheck, CheckCircle2, Building, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PosBookingOption } from "./types";
import { toast } from "sonner";
import { postOrderToBookingFolio } from "@/app/actions/erp-pos";

interface QuickRoomChargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  totalBtn: number;
  bookings: PosBookingOption[];
  onSuccess?: () => void;
}

export function QuickRoomChargeModal({
  open,
  onOpenChange,
  orderId,
  totalBtn,
  bookings,
  onSuccess,
}: QuickRoomChargeModalProps) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Filter in-house rooms
  const inHouseBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      // Must have room assigned
      const roomLabel = b.rooms.map((r) => r.label).join(", ");
      const guestName = b.contact_name || "";
      const agentName = b.agent_name || "";

      if (!q) return true;
      return (
        roomLabel.toLowerCase().includes(q) ||
        guestName.toLowerCase().includes(q) ||
        agentName.toLowerCase().includes(q)
      );
    });
  }, [bookings, search]);

  const handleChargeToRoom = (bookingId: string, roomLabel: string, guestName: string) => {
    if (!orderId) {
      toast.error("No active order selected to charge.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("order_id", orderId);
        formData.set("booking_id", bookingId);
        formData.set("room_payor", "guest"); // Guest incidental tab

        await postOrderToBookingFolio(formData);
        toast.success(`✓ Nu. ${totalBtn} charged to Room ${roomLabel} (${guestName})`);
        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to charge room folio.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden sovereign-glass border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl">
        <div className="p-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                1-Tap Room Charge
              </span>
              <span className="text-xs text-muted-foreground">• In-House Folio</span>
            </div>
            <DialogTitle className="text-xl font-bold text-foreground mt-1 flex items-center justify-between">
              <span>Charge Nu. {totalBtn.toLocaleString("en-BT")} to Room</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select in-house room to post this order directly to the guest&apos;s incidental folio.
            </DialogDescription>
          </DialogHeader>

          {/* Instant Search Bar */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room number (e.g. 101) or guest name..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input text-sm outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
          </div>
        </div>

        {/* In-House Rooms List */}
        <div className="max-h-[360px] overflow-y-auto p-4 space-y-2">
          {inHouseBookings.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No in-house guests match &ldquo;{search}&rdquo;. Verify room number or check-in status.
            </div>
          ) : (
            inHouseBookings.map((b) => {
              const roomLabel = b.rooms.map((r) => r.label).join(", ") || "Assigned";
              const guestName = b.contact_name || "Guest";

              return (
                <button
                  key={b.id}
                  onClick={() => handleChargeToRoom(b.id, roomLabel, guestName)}
                  disabled={isPending}
                  className="w-full p-3.5 rounded-xl sovereign-glass border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex items-center justify-between group active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center font-mono group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-colors">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground">Room</span>
                      <span className="text-base font-black text-foreground">{roomLabel}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                        <span>{guestName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {b.agent_name && (
                          <span className="flex items-center gap-1 text-[11px]">
                            <Building className="w-3 h-3" /> {b.agent_name}
                          </span>
                        )}
                        <span>• Out: {b.check_out}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs group-hover:translate-x-1 transition-transform">
                    <span>Charge</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
