import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@hos-v2/ui";
import {
  hermesGetAlerts,
  hermesPutAlerts,
  type HermesAlertKind,
  type HermesAlertPref,
} from "../../lib/hermes-remote";

const CATALOG: {
  kind: HermesAlertKind;
  title: string;
  blurb: string;
}[] = [
  {
    kind: "guest_check_in",
    title: "Guest check-in",
    blurb: "Push to FO + agent when desk completes CI",
  },
  {
    kind: "guest_check_out",
    title: "Guest check-out",
    blurb: "Push when stay checks out",
  },
  {
    kind: "meal_board",
    title: "Meal board",
    blurb: "Morning covers flash (schedule)",
  },
  {
    kind: "invoice_issued",
    title: "Invoice issued",
    blurb: "Fiscal invoice notify (notify-only)",
  },
  {
    kind: "hk_dirty",
    title: "HK dirty threshold",
    blurb: "Housekeeping pressure alert",
  },
  {
    kind: "night_audit",
    title: "Night audit",
    blurb: "Day-close flash to manager/GM",
  },
];

const ROLE_OPTS = ["fo", "hk", "kitchen", "manager", "gm", "agent"] as const;

export function TelegramAlertsPage() {
  const [prefs, setPrefs] = useState<HermesAlertPref[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await hermesGetAlerts();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPrefs(res.data.prefs);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updatePref(kind: HermesAlertKind, patch: Partial<HermesAlertPref>) {
    setPrefs((prev) =>
      prev.map((p) => (p.kind === kind ? { ...p, ...patch } : p)),
    );
  }

  return (
    <div className="grid gap-3" data-testid="hermes-alerts">
      <p className="m-0 text-[13px] text-[var(--hos-ink-2)]">
        Property alert prefs. Check-in/out pushes fire from FO commands — Telegram never
        mutates folio.
      </p>
      {prefs.length === 0 ? (
        <EmptyState title="Loading prefs…" description="Or refresh if empty." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {CATALOG.map((c) => {
            const pref = prefs.find((p) => p.kind === c.kind);
            if (!pref) return null;
            return (
              <article
                key={c.kind}
                className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm text-[var(--hos-ink)]">{c.title}</strong>
                    <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                      {c.blurb}
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--hos-ink-2)]">
                    <input
                      type="checkbox"
                      checked={pref.enabled}
                      onChange={(e) =>
                        updatePref(c.kind, { enabled: e.target.checked })
                      }
                    />
                    On
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ROLE_OPTS.map((r) => {
                    const on = pref.roles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          on
                            ? "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_14%,transparent)] text-[var(--hos-primary)]"
                            : "border-[var(--hos-line)] text-[var(--hos-ink-3)]"
                        }`}
                        onClick={() => {
                          const roles = on
                            ? pref.roles.filter((x) => x !== r)
                            : [...pref.roles, r];
                          updatePref(c.kind, {
                            roles: roles.length ? roles : ["fo"],
                          });
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                {c.kind === "meal_board" ? (
                  <label className="mt-2 block text-[11px] text-[var(--hos-ink-3)]">
                    Send at
                    <input
                      type="time"
                      className="hos-input ml-2 !min-h-8 !w-auto !text-[12px]"
                      value={pref.sendAt ?? "06:30"}
                      onChange={(e) =>
                        updatePref(c.kind, { sendAt: e.target.value || null })
                      }
                    />
                  </label>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      <Button
        className="hos-btn-ink w-fit !rounded-full"
        disabled={busy || prefs.length === 0}
        onClick={() => {
          setBusy(true);
          void hermesPutAlerts(prefs).then((res) => {
            setBusy(false);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setPrefs(res.data.prefs);
            toast.success("Alert prefs saved");
          });
        }}
      >
        Save prefs
      </Button>
    </div>
  );
}
