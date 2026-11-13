import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@hos-v2/ui";
import { useFrontOfficeStore } from "../../lib/front-office-store";
import {
  hermesListChats,
  hermesListEvents,
  hermesNotifyFolio,
  thimphuTime,
  type HermesChat,
  type HermesEvent,
} from "../../lib/hermes-remote";

export function TelegramBillsPage() {
  const stays = useFrontOfficeStore((s) => s.stays);
  const [events, setEvents] = useState<HermesEvent[]>([]);
  const [chats, setChats] = useState<HermesChat[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [chatRowId, setChatRowId] = useState("");
  const [busy, setBusy] = useState(false);

  const targets = stays.filter(
    (s) =>
      !["cancelled", "no_show"].includes(s.status) && Boolean(s.apiBookingId),
  );

  const load = useCallback(async () => {
    const [ev, ch] = await Promise.all([
      hermesListEvents({ intent: "folio_notify", limit: 50 }),
      hermesListChats(),
    ]);
    if (ev.ok) setEvents(ev.data.events);
    else toast.error(ev.error);
    if (ch.ok) setChats(ch.data.chats.filter((c) => c.status === "active"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4" data-testid="hermes-bills">
      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-sm text-[var(--hos-ink)]">
          Folio notify (read-only)
        </strong>
        <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
          Sends a balance summary to Telegram. Settlement stays on desk — Hermes never
          posts payments.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className="hos-input !min-h-9 max-w-xs !text-[12px]"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          >
            <option value="">Stay…</option>
            {targets.slice(0, 40).map((s) => (
              <option key={s.id} value={s.apiBookingId!}>
                {s.roomNumber ?? "—"} · {s.guestName}
              </option>
            ))}
          </select>
          <select
            className="hos-input !min-h-9 max-w-xs !text-[12px]"
            value={chatRowId}
            onChange={(e) => setChatRowId(e.target.value)}
          >
            <option value="">Default chat</option>
            {chats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName || c.chatId} · {c.role}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="hos-btn-ink !rounded-full"
            disabled={busy}
            onClick={() => {
              if (!bookingId) {
                toast.error("Pick a stay");
                return;
              }
              setBusy(true);
              void hermesNotifyFolio({
                bookingId,
                chatRowId: chatRowId || undefined,
              }).then(async (res) => {
                setBusy(false);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(
                  res.data.delivered
                    ? "Folio summary sent"
                    : "Logged (bot offline)",
                  { description: res.data.error },
                );
                await load();
              });
            }}
          >
            Send folio summary
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
        <div className="border-b border-[var(--hos-line)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
          Folio notify history
        </div>
        {events.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title="No folio notifies yet"
              description="Send a summary above."
            />
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--hos-line)] p-0">
            {events.map((e) => (
              <li key={e.id} className="px-3 py-2.5 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-[var(--hos-ink)]">
                    {e.status ?? "ok"}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                    {thimphuTime(e.createdAt)}
                  </span>
                </div>
                <pre className="m-0 mt-1 whitespace-pre-wrap text-[11px] text-[var(--hos-ink-2)]">
                  {e.text || JSON.stringify(e.payload)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
