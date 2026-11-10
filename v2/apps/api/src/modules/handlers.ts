import { globalOutbox } from "../platform/command.js";

/**
 * Idempotent cross-module handlers (LISTEN worker will drive these).
 * Each handlerKey processes an event id at most once.
 */
export async function runCoreHandlers(): Promise<Record<string, number>> {
  const hk = await globalOutbox.processOnce("housekeeping.on_checkout", async (e) => {
    if (e.type !== "stay.checked_out") return;
    // Room → dirty + task (persisted when DB wired)
    void e;
  });

  const channel = await globalOutbox.processOnce("channel.on_booking", async (e) => {
    if (!e.type.startsWith("booking.") && e.type !== "room.blocked") return;
    void e;
  });

  const finance = await globalOutbox.processOnce("finance.on_ops_post", async (e) => {
    if (
      e.type !== "pos.room_charged" &&
      e.type !== "laundry.delivered" &&
      e.type !== "minibar.consumed" &&
      e.type !== "audit.room_night_posted" &&
      e.type !== "service.completed"
    ) {
      return;
    }
    void e;
  });

  return { housekeeping_on_checkout: hk, channel_on_booking: channel, finance_on_ops: finance };
}
