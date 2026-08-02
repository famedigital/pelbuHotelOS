"use client";

import {
  StayHubDialog,
  type StayHubSeedStay,
} from "@/components/erp/StayHubDialog";
import type { CalendarAgent } from "@/components/erp/CalendarReservationDialog";
import type { RackUnit } from "@/components/erp/RoomRackGrid";
import {
  parseStayHubStep,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type OpenStayHubOptions = {
  bookingId: string;
  assignmentId?: string | null;
  step?: StayHubStepId | null;
  seedStay?: StayHubSeedStay | null;
  agents?: CalendarAgent[];
  units?: RackUnit[];
  onToggleLock?: (stay: StayHubSeedStay) => void;
  board?: "arrivals" | "in_house" | "departures" | "reservations" | "auto";
};

type StayHubContextValue = {
  open: boolean;
  bookingId: string | null;
  openStayHub: (opts: OpenStayHubOptions) => void;
  closeStayHub: () => void;
};

const StayHubContext = createContext<StayHubContextValue | null>(null);

export function useStayHub(): StayHubContextValue {
  const ctx = useContext(StayHubContext);
  if (!ctx) {
    throw new Error("useStayHub must be used within StayHubProvider");
  }
  return ctx;
}

/** Optional hook — returns null when outside provider (rare SSR edges). */
export function useStayHubOptional(): StayHubContextValue | null {
  return useContext(StayHubContext);
}

/**
 * Mount once in DeskShell. Any ERP page can open StayHub by bookingId
 * (or via ?booking=&step= deep link).
 */
export function StayHubProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [preferredStep, setPreferredStep] = useState<StayHubStepId | null>(
    null,
  );
  const [seedStay, setSeedStay] = useState<StayHubSeedStay | null>(null);
  const [agents, setAgents] = useState<CalendarAgent[]>([]);
  const [units, setUnits] = useState<RackUnit[]>([]);
  const [board, setBoard] = useState<OpenStayHubOptions["board"]>("auto");
  const onToggleLockRef = useRef<OpenStayHubOptions["onToggleLock"]>(undefined);
  const suppressUrlWrite = useRef(false);
  const lastOpenedIdRef = useRef<string | null>(null);

  const open = bookingId != null;

  const writeUrl = useCallback(
    (nextBookingId: string | null, step: StayHubStepId | null) => {
      if (suppressUrlWrite.current) return;
      const params = new URLSearchParams(searchParams.toString());
      if (nextBookingId) {
        params.set("booking", nextBookingId);
        if (step) params.set("step", step);
        else params.delete("step");
      } else {
        params.delete("booking");
        params.delete("step");
      }
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openStayHub = useCallback(
    (opts: OpenStayHubOptions) => {
      const id = opts.bookingId.trim();
      if (!id) return;
      const isNew = lastOpenedIdRef.current !== id;
      lastOpenedIdRef.current = id;
      setBookingId(id);
      setAssignmentId(opts.assignmentId ?? null);
      // Only apply preferred step when opening a different stay
      if (isNew || opts.step) {
        setPreferredStep(opts.step ?? null);
      }
      setSeedStay(opts.seedStay ?? null);
      if (opts.agents) setAgents(opts.agents);
      if (opts.units) setUnits(opts.units);
      setBoard(opts.board ?? "auto");
      onToggleLockRef.current = opts.onToggleLock;
      writeUrl(id, opts.step ?? null);
    },
    [writeUrl],
  );

  const closeStayHub = useCallback(() => {
    lastOpenedIdRef.current = null;
    setBookingId(null);
    setAssignmentId(null);
    setPreferredStep(null);
    setSeedStay(null);
    setBoard("auto");
    onToggleLockRef.current = undefined;
    writeUrl(null, null);
  }, [writeUrl]);

  // Deep link: ?booking=&step=
  useEffect(() => {
    const fromUrl = (searchParams.get("booking") ?? "").trim();
    if (!fromUrl) {
      if (bookingId && !suppressUrlWrite.current) {
        // URL cleared externally
      }
      return;
    }
    if (fromUrl === bookingId) return;
    suppressUrlWrite.current = true;
    const step = parseStayHubStep(searchParams.get("step"));
    lastOpenedIdRef.current = fromUrl;
    setBookingId(fromUrl);
    setPreferredStep(step);
    setSeedStay(null);
    setAssignmentId(null);
    setBoard("auto");
    suppressUrlWrite.current = false;
  }, [searchParams, bookingId]);

  const value = useMemo(
    () => ({
      open,
      bookingId,
      openStayHub,
      closeStayHub,
    }),
    [open, bookingId, openStayHub, closeStayHub],
  );

  return (
    <StayHubContext.Provider value={value}>
      {children}
      <StayHubDialog
        open={open}
        bookingId={bookingId}
        assignmentId={assignmentId}
        preferredStep={preferredStep}
        seedStay={seedStay}
        agents={agents}
        units={units}
        board={board}
        onOpenChange={(next) => {
          if (!next) closeStayHub();
        }}
        onToggleLock={
          onToggleLockRef.current
            ? (stay) => onToggleLockRef.current?.(stay)
            : undefined
        }
        onPreferredStepConsumed={() => setPreferredStep(null)}
      />
    </StayHubContext.Provider>
  );
}
