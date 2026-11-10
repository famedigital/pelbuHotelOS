import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, KpiCard, ModuleFrame, StatusLegend } from "@hos-v2/ui";
import { useFrontOfficeStore } from "../../lib/front-office-store";
import {
  hermesApplyDocDraft,
  hermesCreatePairToken,
  hermesDiscardDocDraft,
  hermesListDocDrafts,
  hermesOcrDocument,
  hermesOverview,
  hermesRevokeChat,
  type HermesChat,
  type HermesDocDraft,
  type HermesOverview,
} from "../../lib/hermes-remote";

type TabId = "overview" | "chats" | "docs" | "setup";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "chats", label: "Chats" },
  { id: "docs", label: "Doc inbox" },
  { id: "setup", label: "Setup" },
];

export function TelegramPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<HermesOverview | null>(null);
  const [drafts, setDrafts] = useState<HermesDocDraft[]>([]);
  const [pairLink, setPairLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stays = useFrontOfficeStore((s) => s.stays);
  const hydrateFromApi = useFrontOfficeStore((s) => s.hydrateFromApi);

  const applyTargets = stays.filter(
    (s) =>
      !["cancelled", "no_show", "checked_out"].includes(s.status) &&
      Boolean(s.apiBookingId),
  );

  const refresh = useCallback(async () => {
    const [ov, docs] = await Promise.all([
      hermesOverview(),
      hermesListDocDrafts("all"),
    ]);
    if (ov.ok) setOverview(ov.data);
    else toast.error(ov.error);
    if (docs.ok) setDrafts(docs.data.drafts);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeChats: HermesChat[] =
    overview?.chats.filter((c) => c.status === "active") ?? [];

  return (
    <ModuleFrame
      title="Hermes · Telegram"
      description="Pair FO chats · passport/SDF photo OCR · Guests & Docs apply"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "live", label: "Paired", swatch: "var(--hos-emerald)" },
            { id: "docs", label: "Doc inbox", swatch: "var(--hos-brass)" },
            { id: "ocr", label: "OCR", swatch: "var(--hos-primary)" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4" data-testid="hermes-telegram-page">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`hermes-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                tab === t.id
                  ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                  : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
              }`}
            >
              {t.label}
            </button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="!rounded-full"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void refresh().finally(() => setBusy(false));
            }}
          >
            Refresh
          </Button>
        </div>

        {tab === "overview" ? (
          <div className="grid gap-4">
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
              <strong className="text-sm text-[var(--hos-ink)]">Lazy FO flow</strong>
              <ol className="m-0 mt-2 list-decimal space-y-1 pl-5 text-[12px] text-[var(--hos-ink-2)]">
                <li>Pair an FO phone via Chats → deep link</li>
                <li>Photo passport / CID / SDF in Telegram</li>
                <li>Tap the room button → Guests &amp; Docs fills</li>
                <li>Or scan from StayHub Guests &amp; Docs without Telegram</li>
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
                        fullName: "Hermes Demo Guest",
                        passportOrCid: "P-BT-HERMES-01",
                        nationality: "International",
                      },
                    });
                    setBusy(false);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Simulated passport OCR → Doc inbox");
                    await refresh();
                    setTab("docs");
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
                        fullName: "Hermes Demo Guest",
                        sdfRef: "SDF-HERMES-99",
                        nationality: "International",
                      },
                    });
                    setBusy(false);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Simulated SDF OCR → Doc inbox");
                    await refresh();
                    setTab("docs");
                  })();
                }}
              >
                + Simulate SDF OCR
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
              <div className="border-b border-[var(--hos-line)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                Recent Hermes events
              </div>
              <ul className="m-0 max-h-56 list-none overflow-y-auto p-0">
                {(overview?.recentEvents ?? []).length === 0 ? (
                  <li className="px-3 py-4 text-[12px] text-[var(--hos-ink-3)]">
                    No events yet — pair a chat or simulate OCR.
                  </li>
                ) : (
                  (overview?.recentEvents ?? []).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 border-b border-[var(--hos-line)] px-3 py-2 text-[12px] last:border-b-0"
                    >
                      <span className="font-medium text-[var(--hos-ink)]">{e.intent}</span>
                      <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {tab === "chats" ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["fo", "FO"],
                  ["hk", "HK"],
                  ["kitchen", "Kitchen"],
                  ["manager", "Manager"],
                  ["gm", "GM"],
                  ["agent", "Agent"],
                ] as const
              ).map(([role, label]) => (
              <Button
                key={role}
                size="sm"
                className={role === "fo" ? "hos-btn-ink !rounded-full" : "!rounded-full"}
                variant={role === "fo" ? undefined : "secondary"}
                data-testid={role === "fo" ? "hermes-create-pair" : `hermes-create-pair-${role}`}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void (async () => {
                    const res = await hermesCreatePairToken(
                      role,
                      role === "agent" ? "ag-yap" : undefined,
                    );
                    setBusy(false);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    setPairLink(res.data.deepLink);
                    toast.success(`${label} pair link ready (30 min)`);
                    await refresh();
                  })();
                }}
              >
                {label} pair
              </Button>
              ))}
              {pairLink ? (
                <code
                  data-testid="hermes-pair-link"
                  className="max-w-full truncate rounded-lg border border-[var(--hos-line)] bg-[var(--hos-bg)] px-2 py-1 text-[11px] text-[var(--hos-ink)]"
                >
                  {pairLink}
                </code>
              ) : null}
            </div>
            <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
              Open the link on the FO phone Telegram → bot pairs to this property. Then send
              passport photos.
            </p>
            <ul className="m-0 grid list-none gap-2 p-0">
              {activeChats.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--hos-line)] px-3 py-6 text-center text-[12px] text-[var(--hos-ink-3)]">
                  No active chats — create a pair link.
                </li>
              ) : (
                activeChats.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold text-[var(--hos-ink)]">
                        {c.displayName || `Chat ${c.chatId}`}
                      </div>
                      <div className="text-[11px] text-[var(--hos-ink-3)]">
                        {c.role} · paired {new Date(c.pairedAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!rounded-full text-[var(--hos-ruby)]"
                      onClick={() => {
                        void (async () => {
                          const res = await hermesRevokeChat(c.id);
                          if (!res.ok) toast.error(res.error);
                          else {
                            toast.success("Chat revoked");
                            await refresh();
                          }
                        })();
                      }}
                    >
                      Revoke
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}

        {tab === "docs" ? (
          <div className="grid gap-3" data-testid="hermes-doc-inbox">
            {(drafts.filter((d) => d.status === "pending").length === 0 &&
              drafts.length === 0) ? (
              <p className="m-0 rounded-xl border border-dashed border-[var(--hos-line)] px-3 py-6 text-center text-[12px] text-[var(--hos-ink-3)]">
                Doc inbox empty — simulate OCR or send a Telegram photo.
              </p>
            ) : null}
            {drafts.map((d) => {
              return (
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
                    {d.ocr.nationality || "—"} ·{" "}
                    {new Date(d.createdAt).toLocaleString()}
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
              );
            })}
          </div>
        ) : null}

        {tab === "setup" ? (
          <div className="grid gap-3 text-[13px] text-[var(--hos-ink-2)]">
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
              <strong className="text-[var(--hos-ink)]">API env (server only)</strong>
              <ul className="mt-2 space-y-1 font-mono text-[11px]">
                <li>TELEGRAM_BOT_TOKEN — bot from @BotFather</li>
                <li>TELEGRAM_BOT_USERNAME — without @</li>
                <li>TELEGRAM_WEBHOOK_SECRET — webhook header secret</li>
                <li>GEMINI_API_KEY — passport/SDF Vision OCR</li>
                <li>HERMES_OCR_SIMULATE=1 — desk smoke without Gemini</li>
              </ul>
              <p className="mt-2 m-0 text-[12px]">
                Webhook URL:{" "}
                <code className="rounded bg-[var(--hos-bg)] px-1">
                  POST /v1/telegram/webhook
                </code>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{overview?.botConfigured ? "Bot token set" : "Bot token missing"}</Badge>
                <Badge>
                  {overview?.geminiConfigured ? "Gemini set" : "Gemini missing"}
                </Badge>
                {overview?.simulateMode ? <Badge>Simulate mode</Badge> : null}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
              <strong className="text-[var(--hos-ink)]">Staff cheat-sheet</strong>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--hos-ink-2)]">{`/help — commands
Photo passport → tap room
Photo SDF → tap room
Caption "companion" → sharing guest
Desk Guests & Docs → Scan passport / Scan SDF`}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </ModuleFrame>
  );
}
