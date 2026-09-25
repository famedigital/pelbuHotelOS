"use client";

import { StayHubDialog } from "@/components/erp/StayHubDialog";
import {
  StayHubContext,
  useStayHub,
  useStayHubOptional,
  type OpenStayHubOptions,
  type StayHubSeedStay,
} from "@/components/erp/StayHubContext";
import { StayHubErrorBoundary } from "@/components/erp/stay-hub/StayHubErrorBoundary";
import {
  parseStayHubStep,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export {
  useStayHub,
  useStayHubOptional,
  type OpenStayHubOptions,
  type StayHubSeedStay,
};

/**
 * Mount once in DeskShell. Any ERP page can open StayHub by bookingId
 * (or via ?booking=&step= deep link).
 */
export function StayHubProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [preferredStep, setPreferredStep] = useState<StayHubStepId | null>(
    null,
  );
  const [seedStay, setSeedStay] = useState<StayHubSeedStay | null>(null);
  const [agents, setAgents] = useState<OpenStayHubOptions["agents"]>([]);
  const [staff, setStaff] = useState<OpenStayHubOptions["staff"]>([]);
  const [units, setUnits] = useState<OpenStayHubOptions["units"]>([]);
  const [board, setBoard] = useState<OpenStayHubOptions["board"]>("auto");
  const onToggleLockRef = useRef<OpenStayHubOptions["onToggleLock"]>(undefined);
  /** Skip writeUrl while hydrating open state from the URL. */
  const suppressUrlWrite = useRef(false);
  /**
   * After close, `?booking=` can linger on Next's searchParams until a real
   * navigation. Block the deep-link effect from re-opening that same stay.
   * Store the closed booking id — a different ?booking= must still open.
   */
  const suppressOpenFromUrl = useRef<string | null>(null);
  const lastOpenedIdRef = useRef<string | null>(null);
  /**
   * Last step we applied as preferred for this booking.
   * Prevents ?step=check_out from re-forcing panel every time staff pick Folio.
   */
  const appliedPreferredKeyRef = useRef<string | null>(null);

  const open = bookingId != null;

  const writeUrl = useCallback(
    (nextBookingId: string | null, step: StayHubStepId | null) => {
      if (suppressUrlWrite.current) return;
      if (typeof window === "undefined") return;
      // Native replaceState — do not router.replace. Calendar is force-dynamic
      // and a booking= URL change refetches the whole rack RSC, which Next
      // surfaces as "This page couldn't load".
      const params = new URLSearchParams(window.location.search);
      if (nextBookingId) {
        params.set("booking", nextBookingId);
        if (step) params.set("step", step);
        else params.delete("step");
        // Fast Book deep-link; drop so closing StayHub does not re-open create.
        params.delete("new");
      } else {
        params.delete("booking");
        params.delete("step");
      }
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === href) return;
      window.history.replaceState(window.history.state, "", href);
    },
    [pathname],
  );

  const [boundaryEpoch, setBoundaryEpoch] = useState(0);

  const openStayHub = useCallback(
    (opts: OpenStayHubOptions) => {
      const id = opts.bookingId.trim();
      if (!id) return;
      suppressOpenFromUrl.current = null;
      // Remount error boundary so a prior StayHub crash does not swallow the sheet.
      setBoundaryEpoch((n) => n + 1);
      const isNew = lastOpenedIdRef.current !== id;
      lastOpenedIdRef.current = id;
      setBookingId(id);
      setAssignmentId(opts.assignmentId ?? null);

      if (opts.replaceInParty) {
        // Keep the sheet mounted. Drop preferred-step so a stale ?step=
        // does not yank the new room off the form staff were already on.
        appliedPreferredKeyRef.current = opts.step
          ? `${id}:${opts.step}`
          : null;
        setPreferredStep(opts.step ?? null);
        setSeedStay(null);
        if (opts.board) setBoard(opts.board);
        writeUrl(id, opts.step ?? null);
        return;
      }

      // Only apply preferred step when opening a different stay or explicit step
      if (isNew || opts.step) {
        if (opts.step) {
          appliedPreferredKeyRef.current = `${id}:${opts.step}`;
          setPreferredStep(opts.step);
        } else if (isNew) {
          appliedPreferredKeyRef.current = null;
          setPreferredStep(null);
        }
      }
      setSeedStay(opts.seedStay ?? null);
      if (opts.agents) setAgents(opts.agents);
      if (opts.staff) setStaff(opts.staff);
      if (opts.units) setUnits(opts.units);
      setBoard(opts.board ?? "auto");
      onToggleLockRef.current = opts.onToggleLock;
      writeUrl(id, opts.step ?? null);
    },
    [writeUrl],
  );

  const closeStayHub = useCallback(() => {
    // Block deep-link re-open of *this* booking until it leaves the URL.
    const closingId = lastOpenedIdRef.current;
    suppressOpenFromUrl.current = closingId;
    lastOpenedIdRef.current = null;
    appliedPreferredKeyRef.current = null;
    setBookingId(null);
    setAssignmentId(null);
    setPreferredStep(null);
    setSeedStay(null);
    setBoard("auto");
    onToggleLockRef.current = undefined;
    writeUrl(null, null);
  }, [writeUrl]);

  const clearPreferredStep = useCallback(() => {
    setPreferredStep(null);
  }, []);

  /** Staff changed panel — keep URL honest and stop preferred re-apply. */
  const setStayHubStepInUrl = useCallback(
    (step: StayHubStepId | null) => {
      if (!bookingId) return;
      if (step) {
        appliedPreferredKeyRef.current = `${bookingId}:${step}`;
      }
      setPreferredStep(null);
      writeUrl(bookingId, step);
    },
    [bookingId, writeUrl],
  );

  // Deep link: ?booking=&step= (and re-open guard after close)
  useEffect(() => {
    const fromUrl = (searchParams.get("booking") ?? "").trim();
    if (!fromUrl) {
      // URL stripped — deep links / openStayHub can hydrate again.
      suppressOpenFromUrl.current = null;
      return;
    }
    // Only suppress re-opening the stay we just closed (stale searchParams).
    // A different booking via row click / soft nav must open.
    if (suppressOpenFromUrl.current === fromUrl) return;
    if (suppressOpenFromUrl.current) {
      suppressOpenFromUrl.current = null;
    }
    const step = parseStayHubStep(searchParams.get("step"));
    const pathBoard = (() => {
      if (pathname.includes("/arrivals")) return "arrivals" as const;
      if (pathname.includes("/departures")) return "departures" as const;
      if (pathname.includes("/reservations")) return "reservations" as const;
      if (pathname.includes("/in-house")) return "in_house" as const;
      return "auto" as const;
    })();

    // Same booking: only re-apply preferred when the URL step is *new*
    // (e.g. Back to stay with different panel). Never re-force check_out
    // after staff already navigated to Folio while URL still says check_out.
    if (fromUrl === bookingId) {
      if (step) {
        const key = `${fromUrl}:${step}`;
        if (appliedPreferredKeyRef.current !== key) {
          appliedPreferredKeyRef.current = key;
          setPreferredStep(step);
        }
      }
      return;
    }

    suppressUrlWrite.current = true;
    lastOpenedIdRef.current = fromUrl;
    setBookingId(fromUrl);
    if (step) {
      appliedPreferredKeyRef.current = `${fromUrl}:${step}`;
      setPreferredStep(step);
    } else {
      appliedPreferredKeyRef.current = null;
      setPreferredStep(null);
    }
    setSeedStay(null);
    setAssignmentId(null);
    setBoard(pathBoard);
    suppressUrlWrite.current = false;
  }, [searchParams, bookingId, pathname]);

  const value = useMemo(
    () => ({
      open,
      bookingId,
      openStayHub,
      closeStayHub,
      setStayHubStepInUrl,
    }),
    [open, bookingId, openStayHub, closeStayHub, setStayHubStepInUrl],
  );

  return (
    <StayHubContext.Provider value={value}>
      {children}
      <StayHubErrorBoundary
        resetToken={boundaryEpoch}
        onCrash={closeStayHub}
      >
        <StayHubDialog
          open={open}
          bookingId={bookingId}
          assignmentId={assignmentId}
          preferredStep={preferredStep}
          seedStay={seedStay}
          agents={agents ?? []}
          staff={staff ?? []}
          units={units ?? []}
          board={board}
          onOpenChange={(next) => {
            if (!next) closeStayHub();
          }}
          onToggleLock={
            onToggleLockRef.current
              ? (stay) => onToggleLockRef.current?.(stay)
              : undefined
          }
          onPreferredStepConsumed={clearPreferredStep}
          onPanelChange={setStayHubStepInUrl}
        />
      </StayHubErrorBoundary>
    </StayHubContext.Provider>
  );
}
