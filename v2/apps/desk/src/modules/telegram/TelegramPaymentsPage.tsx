import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@hos-v2/ui";
import {
  hermesAckDepositProof,
  hermesListEvents,
  hermesRecordDepositProof,
  thimphuTime,
  type HermesEvent,
} from "../../lib/hermes-remote";

type Tab = "all" | "pending" | "acked";

export function TelegramPaymentsPage() {
  const [events, setEvents] = useState<HermesEvent[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await hermesListEvents({ intent: "deposit_proof", limit: 80 });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEvents(res.data.events);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return events;
    if (tab === "pending")
      return events.filter((e) => (e.status ?? "pending") === "pending");
    return events.filter((e) => e.status === "acked");
  }, [events, tab]);

  return (
    <div className="grid gap-4" data-testid="hermes-payments">
      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-sm text-[var(--hos-ink)]">
          Deposit / proof inbox
        </strong>
        <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
          Record or ack payment proofs for follow-up. Does not post till or folio
          payments.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="hos-input !min-h-9 min-w-[12rem] flex-1 !rounded-xl !text-[12px]"
            placeholder="Proof note / bank ref…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <input
            className="hos-input !min-h-9 w-28 !rounded-xl !text-[12px]"
            placeholder="Nu amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            size="sm"
            className="hos-btn-ink !rounded-full"
            disabled={busy}
            onClick={() => {
              if (!note.trim()) {
                toast.error("Note required");
                return;
              }
              const amountBtn = amount.trim() ? Number(amount) : undefined;
              if (amount.trim() && !Number.isFinite(amountBtn)) {
                toast.error("Invalid amount");
                return;
              }
              setBusy(true);
              void hermesRecordDepositProof({
                text: note.trim(),
                amountBtn,
              }).then(async (res) => {
                setBusy(false);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Proof recorded (pending ack)");
                setNote("");
                setAmount("");
                await load();
              });
            }}
          >
            Record proof
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["acked", "Acked"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
              tab === id
                ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No deposit proofs"
          description="Record a desk note or wait for Telegram deposit intents."
        />
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
                  {e.status ?? "pending"}
                </span>
                <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                  {thimphuTime(e.createdAt)}
                </span>
              </div>
              <p className="m-0 mt-1 text-[13px] text-[var(--hos-ink)]">
                {e.text}
              </p>
              {typeof e.payload.amountBtn === "number" ? (
                <p className="m-0 mt-0.5 font-mono text-[12px] text-[var(--hos-ink-2)]">
                  Nu {e.payload.amountBtn}
                </p>
              ) : null}
              {(e.status ?? "pending") === "pending" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 !rounded-full"
                  onClick={() => {
                    void hermesAckDepositProof(e.id).then(async (res) => {
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success("Acked (no payment posted)");
                        await load();
                      }
                    });
                  }}
                >
                  Ack
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
