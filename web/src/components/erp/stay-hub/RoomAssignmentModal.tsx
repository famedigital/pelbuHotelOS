"use client";

import { checkIsDeskAdminOrManager } from "@/app/actions/desk";
import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  BedDouble,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Lock,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  loadStayAvailableRooms,
  assignOrMoveStayRoom,
  autoAssignStayBestRoom,
  type StayRoomOption,
  type StayRoomListResult,
} from "@/app/actions/stay-room-assign";

interface RoomAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  contactName: string;
  currentRoomLabel?: string | null;
  isInHouse?: boolean;
  onSuccess: () => void;
}

export function RoomAssignmentModal({
  isOpen,
  onClose,
  bookingId,
  contactName,
  currentRoomLabel,
  isInHouse = false,
  onSuccess,
}: RoomAssignmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Extract<StayRoomListResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "clean_only" | "available_only">("available_only");
  const [searchQuery, setSearchQuery] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [upgradeChoice, setUpgradeChoice] = useState<"complimentary" | "top_up">("complimentary");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [isPending, startTransition] = useTransition();

  // Load available rooms on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSelectedUnitId("");
    setManagerPin("");
    setMoveReason("");

    void checkIsDeskAdminOrManager().then((admin) => setIsAdmin(admin));
    void loadStayAvailableRooms(bookingId).then((res) => {
      setLoading(false);
      if (res.ok) {
        setData(res);
        if (res.currentRoomUnitId) {
          setSelectedUnitId(res.currentRoomUnitId);
        }
      } else {
        setError(res.error);
        toast.error("Could not load rooms: " + res.error);
      }
    });
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  // Filtered rooms
  const allRooms = data?.rooms ?? [];
  const filteredRooms = allRooms.filter((r) => {
    if (filterMode === "clean_only" && r.hkStatus !== "clean" && r.hkStatus !== "inspected") {
      return false;
    }
    if (filterMode === "available_only" && !r.available && !r.isCurrent) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = r.label.toLowerCase().includes(q);
      const matchType = r.typeName.toLowerCase().includes(q);
      const matchFloor = (r.floorLabel ?? "").toLowerCase().includes(q);
      return matchLabel || matchType || matchFloor;
    }
    return true;
  });

  const selectedRoom = allRooms.find((r) => r.id === selectedUnitId) ?? null;
  const isChangingRoom = selectedRoom != null && !selectedRoom.isCurrent;

  // Handle Manual Assignment or Shift
  const handleConfirmAssignment = () => {
    if (!selectedUnitId) {
      toast.error("Please pick a room door.");
      return;
    }
    if (selectedRoom?.isCurrent) {
      toast.info("This room is already assigned to this stay.");
      onClose();
      return;
    }

    startTransition(async () => {
      toast.loading("Assigning room...", { id: "room_assign" });
      const res = await assignOrMoveStayRoom({
        bookingId,
        targetRoomUnitId: selectedUnitId,
        assignmentId: data?.currentAssignmentId,
        isInHouse: data?.isInHouse ?? isInHouse,
        upgradeChoice,
        managerPin,
        reason: moveReason || (isInHouse ? "Guest requested room move" : "Desk room assignment"),
      });

      if (res.ok) {
        toast.success(res.message, { id: "room_assign" });
        onSuccess();
        onClose();
      } else {
        toast.error(res.error ?? "Failed to assign room", { id: "room_assign" });
      }
    });
  };

  // Handle 1-Tap Auto Assign
  const handleAutoAssign = () => {
    startTransition(async () => {
      toast.loading("Finding best available clean room...", { id: "auto_assign" });
      const res = await autoAssignStayBestRoom(bookingId);
      if (res.ok) {
        toast.success(res.message, { id: "auto_assign" });
        onSuccess();
        onClose();
      } else {
        toast.error(res.error ?? "Could not auto-assign room", { id: "auto_assign" });
      }
    });
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl my-auto rounded-3xl bg-background border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Top Edge */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none" />

        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <BedDouble className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                {isInHouse ? "In-House Room Shift & Move" : "Room Assignment Controller"}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {contactName} • {data?.checkIn} → {data?.checkOut} • Current:{" "}
              <strong className="text-foreground">
                {currentRoomLabel ? `Room ${currentRoomLabel}` : "Unassigned"}
              </strong>
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="p-4 border-b border-border/40 bg-muted/10 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* SEARCH & FILTERS */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search room door or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-border/60 bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-1 bg-background rounded-xl p-1 border border-border/60">
              <button
                type="button"
                onClick={() => setFilterMode("available_only")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                  filterMode === "available_only"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Free Rooms
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("clean_only")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                  filterMode === "clean_only"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Clean Only
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                  filterMode === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
            </div>
          </div>

          {/* 1-TAP AUTO ASSIGN BUTTON (FOR ARRIVALS) */}
          {!isInHouse && (
            <Button
              type="button"
              size="sm"
              disabled={isPending || loading}
              onClick={handleAutoAssign}
              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
              title="Automatically picks the best clean available room"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>1-Tap Auto Assign</span>
            </Button>
          )}
        </div>

        {/* ROOM CARDS GRID (SCROLLABLE) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Scanning physical room inventory for stay dates...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-destructive bg-destructive/10 rounded-2xl border border-destructive/20">
              {error}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No matching rooms found for the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredRooms.map((room) => {
                const isSelected = selectedUnitId === room.id;
                const isClean = room.hkStatus === "clean" || room.hkStatus === "inspected";

                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={!room.available && !room.isCurrent}
                    onClick={() => setSelectedUnitId(room.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden h-28",
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40 shadow-md"
                        : room.isCurrent
                        ? "bg-blue-500/10 border-blue-500/40"
                        : room.available
                        ? "bg-muted/30 border-border/60 hover:bg-muted/60 hover:border-border cursor-pointer"
                        : "bg-muted/10 border-border/30 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-black text-foreground">
                          Room {room.label}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                        {room.isCurrent && !isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-muted-foreground truncate mt-0.5">
                        {room.typeName}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] mt-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded font-bold uppercase",
                          isClean
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {room.hkStatus}
                      </span>

                      <span className="text-muted-foreground font-semibold truncate max-w-[80px]">
                        {room.available ? "Free" : "Busy"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* IN-HOUSE SHIFT EXTRA OPTIONS (UPGRADE / REASON / PIN) */}
          {isInHouse && isChangingRoom && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 animate-in fade-in duration-150">
              <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>In-House Room Move Protocol</span>
              </span>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Guest will move from <strong>Room {currentRoomLabel}</strong> to{" "}
                <strong>Room {selectedRoom?.label}</strong> ({selectedRoom?.typeName}).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Tariff Treatment
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUpgradeChoice("complimentary")}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center",
                        upgradeChoice === "complimentary"
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border/60 text-muted-foreground"
                      )}
                    >
                      Complimentary
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpgradeChoice("top_up")}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center",
                        upgradeChoice === "top_up"
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border/60 text-muted-foreground"
                      )}
                    >
                      Bill Tariff Difference
                    </button>
                  </div>
                </div>

                <div>
                  {isAdmin ? (
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Authorization
                      </label>
                      <div className="h-8 px-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Admin Session (PIN exempt)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1 flex items-center justify-between">
                        <span>Manager PIN</span>
                        <span className="text-[10px] text-rose-500 font-bold">* Front Desk</span>
                      </label>
                      <input
                        type="password"
                        maxLength={8}
                        placeholder="Enter Manager PIN"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value)}
                        className="w-full h-8 px-3 rounded-xl border border-border/60 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 px-4 text-xs font-bold rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isPending || !selectedUnitId || selectedRoom?.isCurrent}
            onClick={handleConfirmAssignment}
            className="h-10 px-5 text-xs font-black rounded-xl bg-primary text-primary-foreground gap-2 shadow active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isInHouse
                ? `Move to Room ${selectedRoom?.label || ""}`
                : `Assign Room ${selectedRoom?.label || ""}`}
            </span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
