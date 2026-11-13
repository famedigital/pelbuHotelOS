import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, EmptyState, KpiCard } from "@hos-v2/ui";
import { hermesOcrDocument, thimphuTime } from "../../lib/hermes-remote";
import { useTelegramOverview } from "./telegram-context";

export function TelegramOverviewPage() {
  const { overview, refresh } = useTelegramOverview();
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4" data-testid="hermes-overview">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Paired chats" value={String(overview?.pairedChats ?? "—")} />
        <KpiCard label="Pending docs" value={String(overview?.pendingDocs ?? "—")} />
        <KpiCard label="Applied today" value={String(overview?.appliedToday ?? "—")} />
        <KpiCard
          label="Bot"
          value={overview?.botConfigured ? "Live" : "Dev"}
          delta={overview?.botUsername}
        />
      </div>

      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-sm text-[var(--hos-ink)]">How Innora Bot works</strong>
        <ol className="m-0 mt-2 list-decimal space-y-1 pl-5 text-[12px] text-[var(--hos-ink-2)]">
          <li>Pair FO / HK / Kitchen / Agent via Pair…</li>
          <li>Photo passport or SDF in Telegram → Doc inbox</li>
          <li>Apply to stay · Guests &amp; Docs · agent CI/CO alerts</li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="hos-btn-ink !rounded-full"
          data-testid="hermes-simulate-ocr"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void (async () => {
              const res = await hermesOcrDocument({
                simulate: true,
                hintKind: "passport",
                simulateFields: {
                  fullName: "Innora Bot Demo Guest",
                  passportOrCid: "P-BT-INNORA-01",
                  nationality: "International",
                },
              });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Simulated passport OCR → Docs");
              await refresh();
            })();
          }}
        >
          + Simulate passport OCR
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="!rounded-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void (async () => {
              const res = await hermesOcrDocument({
                simulate: true,
                hintKind: "sdf",
                simulateFields: {
                  fullName: "Innora Bot Demo Guest",
                  sdfRef: "SDF-INNORA-99",
                  nationality: "International",
                },
              });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Simulated SDF OCR → Docs");
              await refresh();
            })();
          }}
        >
          + Simulate SDF OCR
        </Button>
        <Link
          to="/telegram/docs"
          className="hos-btn-tactile inline-flex min-h-8 items-center rounded-full border border-[var(--hos-line)] px-3 text-[12px] font-semibold text-[var(--hos-ink-2)] no-underline"
        >
          Open Docs
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
        <div className="flex items-center justify-between border-b border-[var(--hos-line)] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
            Recent events
          </span>
          <Link
            to="/telegram/log"
            className="text-[11px] font-semibold text-[var(--hos-primary)] no-underline"
          >
            Full log
          </Link>
        </div>
        <ul className="m-0 max-h-56 list-none overflow-y-auto p-0">
          {(overview?.recentEvents ?? []).length === 0 ? (
            <li className="px-3 py-4">
              <EmptyState
                title="No events yet"
                description="Pair a chat or simulate OCR."
              />
            </li>
          ) : (
            (overview?.recentEvents ?? []).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--hos-line)] px-3 py-2 text-[12px] last:border-b-0"
              >
                <span className="font-medium text-[var(--hos-ink)]">{e.intent}</span>
                <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                  {thimphuTime(e.createdAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
