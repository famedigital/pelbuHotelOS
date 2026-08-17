"use client";

import type { CalendarAgent } from "@/components/erp/CalendarReservationDialog";
import type { BookableStaff } from "@/components/erp/StaffPicker";
import type { RackStay, RackUnit } from "@/components/erp/RoomRackGrid";
import type { StayHubStepId } from "@/lib/folio/stay-hub-cycle";
import { createContext, useContext } from "react";

/** Seed shape from room rack (assignment-centric). */
export type StayHubSeedStay = RackStay;

export type OpenStayHubOptions = {
  bookingId: string;
  assignmentId?: string | null;
  step?: StayHubStepId | null;
  seedStay?: StayHubSeedStay | null;
  agents?: CalendarAgent[];
  staff?: BookableStaff[];
  units?: RackUnit[];
  onToggleLock?: (stay: StayHubSeedStay) => void;
  board?: "arrivals" | "in_house" | "departures" | "reservations" | "auto";
};

export type StayHubContextValue = {
  open: boolean;
  bookingId: string | null;
  openStayHub: (opts: OpenStayHubOptions) => void;
  closeStayHub: () => void;
  /** Rail / body panel change — keeps ?step= in sync without re-forcing preferred. */
  setStayHubStepInUrl: (step: StayHubStepId | null) => void;
};

export const StayHubContext = createContext<StayHubContextValue | null>(null);

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
