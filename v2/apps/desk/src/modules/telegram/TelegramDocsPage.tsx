import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@hos-v2/ui";
import { useFrontOfficeStore } from "../../lib/front-office-store";
import {
  hermesApplyDocDraft,
  hermesDiscardDocDraft,
  hermesListDocDrafts,
  type HermesDocDraft,
} from "../../lib/hermes-remote";
import { useTelegramOverview } from "./telegram-context";

export function TelegramDocsPage() {
  const { refresh } = useTelegramOverview();
  const [drafts, setDrafts] = useState<HermesDocDraft[]>([]);
  const stays = useFrontOfficeStore((s) => s.stays);
  const hydrateFromApi = useFrontOfficeStore((s) => s.hydrateFromApi);

  const applyTargets = stays.filter(
    (s) =>
      !["cancelled", "no_show", "checked_out"].includes(s.status) &&
      Boolean(s.apiBookingId),
  );

  const load = useCallback(async () => {
    const docs = await hermesListDocDrafts("all");
    if (docs.ok) setDrafts(docs.data.drafts);
    else toast.error(docs.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-3" data-testid="hermes-doc-inbox">
      {drafts.length === 0 ? (
        <EmptyState
          title="Doc inbox empty"
          description="Simulate OCR on Overview or send a Telegram passport/SDF photo."
        />
      ) : null}
      {drafts.map((d) => (
        <div
          key={d.id}
          data-testid={`hermes-draft-${d.id}`}
          className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{d.kind}</Badge>
            <Badge>{d.status}</Badge>
            <span className="font-semibold text-[var(--hos-ink)]">
              {d.ocr.fullName || "—"}
            </span>
            <span className="font-mono text-[11px] text-[var(--hos-ink-2)]">
              {d.ocr.passportOrCid || d.ocr.sdfRef || ""}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--hos-ink-3)]">
            {d.ocr.nationality || "—"} · {new Date(d.createdAt).toLocaleString()}
            {d.ocr.confidence != null
              ? ` · conf ${(d.ocr.confidence * 100).toFixed(0)}%`
              : ""}
          </div>
          {d.status === "pending" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                id={`hermes-apply-stay-${d.id}`}
                className="hos-input !min-h-9 max-w-xs !text-[12px]"
                defaultValue=""
                data-testid={`hermes-apply-stay-${d.id}`}
              >
                <option value="" disabled>
                  Apply to stay…
                </option>
                {applyTargets.slice(0, 30).map((s) => (
                  <option key={s.id} value={s.apiBookingId!}>
                    {s.roomNumber ?? "—"} · {s.guestName}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                className="!rounded-full"
                data-testid={`hermes-apply-${d.id}`}
                onClick={() => {
                  const sel = document.getElementById(
                    `hermes-apply-stay-${d.id}`,
                  ) as HTMLSelectElement | null;
                  const bookingId = sel?.value;
                  if (!bookingId) {
                    toast.error("Pick a stay");
                    return;
                  }
                  void (async () => {
                    const res = await hermesApplyDocDraft({
                      draftId: d.id,
                      bookingId,
                    });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(`Applied · ${res.data.guestName}`);
                    await hydrateFromApi();
                    await load();
                    await refresh();
                  })();
                }}
              >
                Apply primary
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="!rounded-full"
                onClick={() => {
                  const sel = document.getElementById(
                    `hermes-apply-stay-${d.id}`,
                  ) as HTMLSelectElement | null;
                  const bookingId = sel?.value;
                  if (!bookingId) {
                    toast.error("Pick a stay");
                    return;
                  }
                  void (async () => {
                    const res = await hermesApplyDocDraft({
                      draftId: d.id,
                      bookingId,
                      asCompanion: true,
                    });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(`Companion · ${res.data.guestName}`);
                    await hydrateFromApi();
                    await load();
                    await refresh();
                  })();
                }}
              >
                As companion
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="!rounded-full"
                onClick={() => {
                  void (async () => {
                    const res = await hermesDiscardDocDraft(d.id);
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.message("Discarded");
                      await load();
                      await refresh();
                    }
                  })();
                }}
              >
                Discard
              </Button>
            </div>
          ) : null}
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-[var(--hos-ink-3)]">
              Inspect OCR JSON
            </summary>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--hos-bg)] p-2 text-[10px] text-[var(--hos-ink-2)]">
              {JSON.stringify(d.ocr, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
