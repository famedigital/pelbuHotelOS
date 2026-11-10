import { isBrowserOnline } from "@hotel-os/engine";

/** Desk guard: money / KOT / night audit must not fire while offline. */
export function assertOnlineMoney(actionLabel: string): void {
  if (!isBrowserOnline()) {
    throw new Error(
      `Offline — cannot ${actionLabel}. Reconnect, then retry (money stays server-authoritative).`,
    );
  }
}
