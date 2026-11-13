import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, EmptyState } from "@hos-v2/ui";
import {
  hermesListEvents,
  thimphuTime,
  type HermesEvent,
} from "../../lib/hermes-remote";

export function TelegramLogPage() {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<HermesEvent[]>([]);
  const [intent, setIntent] = useState(params.get("intent") ?? "");
  const [kind, setKind] = useState(params.get("kind") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [selectedId, setSelectedId] = useState(params.get("event") ?? "");

  const load = useCallback(async () => {
    const res = await hermesListEvents({
      intent: intent || undefined,
      kind: kind || undefined,
      q: q || undefined,
      limit: 80,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEvents(res.data.events);
  }, [intent, kind, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ev = params.get("event");
    if (ev) setSelectedId(ev);
  }, [params]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_280px]" data-testid="hermes-log">
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            className="hos-input !min-h-9 min-w-[8rem] flex-1 !rounded-xl !text-[12px]"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            className="hos-input !min-h-9 w-36 !rounded-xl !text-[12px]"
            placeholder="intent"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />
          <input
            className="hos-input !min-h-9 w-28 !rounded-xl !text-[12px]"
            placeholder="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          />
          <Button
            size="sm"
            className="!rounded-full"
            onClick={() => {
              const next = new URLSearchParams();
              if (intent) next.set("intent", intent);
              if (kind) next.set("kind", kind);
              if (q) next.set("q", q);
              setParams(next);
              void load();
            }}
          >
            Filter
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-[var(--hos-line)] text-[9px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]">
                <th className="px-2.5 py-2">Time</th>
                <th className="px-2 py-2">Dir</th>
                <th className="px-2 py-2">Intent</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hos-line)]">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6">
                    <EmptyState
                      title="No events"
                      description="Pair, OCR, or FO check-in to stream activity."
                    />
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr
                    key={e.id}
                    className={`cursor-pointer ${
                      selectedId === e.id
                        ? "bg-[color-mix(in_srgb,var(--hos-primary)_10%,transparent)]"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedId(e.id);
                      const next = new URLSearchParams(params);
                      next.set("event", e.id);
                      setParams(next);
                    }}
                  >
                    <td className="px-2.5 py-2 font-mono tabular-nums text-[var(--hos-ink-2)]">
                      {thimphuTime(e.createdAt)}
                    </td>
                    <td className="px-2 py-2 uppercase text-[var(--hos-ink-3)]">
                      {e.direction}
                    </td>
                    <td className="px-2 py-2 font-semibold text-[var(--hos-ink)]">
                      {e.intent}
                    </td>
                    <td className="px-2 py-2">{e.status ?? "—"}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      {e.latencyMs ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-sm text-[var(--hos-ink)]">Detail</strong>
        {!selected ? (
          <p className="mt-2 text-[12px] text-[var(--hos-ink-3)]">
            Select a row.
          </p>
        ) : (
          <div className="mt-2 space-y-2 text-[12px] text-[var(--hos-ink-2)]">
            <div>
              <span className="text-[var(--hos-ink-3)]">Intent</span>
              <div className="font-semibold text-[var(--hos-ink)]">{selected.intent}</div>
            </div>
            <div>
              <span className="text-[var(--hos-ink-3)]">Text</span>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--hos-bg)] p-2 text-[10px]">
                {selected.text || "—"}
              </pre>
            </div>
            <div>
              <span className="text-[var(--hos-ink-3)]">Payload</span>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-[var(--hos-bg)] p-2 text-[10px]">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
