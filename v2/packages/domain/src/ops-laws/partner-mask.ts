/**
 * B2B Tour Operator masked calendar privacy.
 * Competing agents see Occupied · Tour Group — never guest/agent/rate.
 */

export type PartnerCalendarCell = {
  stayDate: string;
  roomId: string;
  roomNumber: string;
  state: "free" | "held" | "occupied";
  ownerAgentId: string | null;
  guestName: string | null;
  bookingRef: string | null;
  netRateBtn: number | null;
};

export type MaskedPartnerCell = {
  stayDate: string;
  roomId: string;
  roomNumber: string;
  displayState: "free" | "own" | "masked_occupied";
  label: string;
  guestName: string | null;
  bookingRef: string | null;
  netRateBtn: number | null;
};

export function maskPartnerCalendar(
  cells: PartnerCalendarCell[],
  viewerAgentId: string,
): MaskedPartnerCell[] {
  return cells.map((c) => {
    if (c.state === "free" || !c.ownerAgentId) {
      return {
        stayDate: c.stayDate,
        roomId: c.roomId,
        roomNumber: c.roomNumber,
        displayState: "free",
        label: "Available",
        guestName: null,
        bookingRef: null,
        netRateBtn: c.netRateBtn,
      };
    }
    if (c.ownerAgentId === viewerAgentId) {
      return {
        stayDate: c.stayDate,
        roomId: c.roomId,
        roomNumber: c.roomNumber,
        displayState: "own",
        label: c.guestName ?? "Your booking",
        guestName: c.guestName,
        bookingRef: c.bookingRef,
        netRateBtn: c.netRateBtn,
      };
    }
    return {
      stayDate: c.stayDate,
      roomId: c.roomId,
      roomNumber: c.roomNumber,
      displayState: "masked_occupied",
      label: "Occupied · Tour Group",
      guestName: null,
      bookingRef: null,
      netRateBtn: null,
    };
  });
}
