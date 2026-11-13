import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  guestCrmMatchesQuery,
  guestCrmSearchHaystack,
  stayOverlapsRange,
  staysToCsv,
  sumGuestStayMoney,
  type GuestStayMoneyInput,
} from "@hos-v2/domain";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { readDeskProperty } from "../lib/desk-session";
import {
  folioTotals,
  formatNu,
  useFrontOfficeStore,
  type Stay,
} from "../lib/front-office-store";
import { escapePrintHtml, printHtmlDocument } from "../lib/print-html";

type GuestDossier = {
  key: string;
  name: string;
  nationality: string;
  passportOrCid: string;
  phone: string;
  email: string;
  vip: boolean;
  stays: Stay[];
  ltv: number;
  flag: "vip" | "frequent" | "spender" | "normal";
};

function stayMoney(s: Stay): GuestStayMoneyInput {
  const t = folioTotals(s);
  return {
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    charged: t.charged,
    paid: t.paid,
    balance: t.balance,
    guestName: s.guestName,
    confirmationNo: s.confirmationNo,
    roomNumber: s.roomNumber,
    status: s.status,
    companions: s.companions?.map((c) => ({ name: c.name, fullName: c.name })),
    notes: s.notes,
    agencyName: s.agencyName,
    groupName: s.groupName,
  };
}

function notesKey(propertySlug: string, dossierKey: string): string {
  return `hos.v2.guestNotes.${propertySlug}.${dossierKey}`;
}

export function GuestsPage() {
  const reduce = useReducedMotion();
  const stays = useFrontOfficeStore((s) => s.stays);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const propertySlug =
    readDeskProperty()?.slug?.trim() ||
    localStorage.getItem("hos.v2.propertySlug")?.trim() ||
    "demo-hotel";

  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [prefNote, setPrefNote] = useState("");
  const [prefTick, setPrefTick] = useState(0);

  const dossiers = useMemo(() => {
    const map = new Map<string, GuestDossier>();
    for (const s of stays) {
      const key = (s.agencyName || s.groupName || s.passportOrCid || s.guestName).trim();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: s.agencyName || s.groupName || s.guestName,
          nationality: s.nationality,
          passportOrCid: s.passportOrCid,
          phone: s.guestPhone,
          email: s.guestEmail,
          vip: s.vip,
          stays: [s],
          ltv: Math.max(0, folioTotals(s).charged) + s.depositPaid,
          flag: s.vip ? "vip" : "normal",
        });
      } else {
        existing.stays.push(s);
        existing.vip = existing.vip || s.vip;
        existing.ltv += folioTotals(s).charged + s.depositPaid;
        if (!existing.nationality && s.nationality) existing.nationality = s.nationality;
      }
    }
    for (const d of map.values()) {
      if (d.stays.length >= 2) d.flag = d.vip ? "vip" : "frequent";
      if (d.ltv > 40000) d.flag = d.vip ? "vip" : "spender";
      if (d.vip) d.flag = "vip";
    }
    return [...map.values()].sort((a, b) => b.ltv - a.ltv);
  }, [stays]);

  const filtered = useMemo(() => {
    return dossiers.filter((d) => {
      const dateScoped = d.stays.filter((s) =>
        stayOverlapsRange(s, fromDate, toDate),
      );
      if (dateScoped.length === 0) return false;
      const hay = guestCrmSearchHaystack({
        name: d.name,
        passportOrCid: d.passportOrCid,
        nationality: d.nationality,
        phone: d.phone,
        stays: dateScoped.map(stayMoney),
      });
      return guestCrmMatchesQuery(hay, q);
    });
  }, [dossiers, q, fromDate, toDate]);

  const selected = filtered.find((d) => d.key === selectedKey) ?? filtered[0] ?? null;

  const selectedStays = useMemo(() => {
    if (!selected) return [];
    return selected.stays
      .filter((s) => stayOverlapsRange(s, fromDate, toDate))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [selected, fromDate, toDate]);

  const money = useMemo(
    () => sumGuestStayMoney(selectedStays.map(stayMoney)),
    [selectedStays],
  );

  useEffect(() => {
    if (!selected) {
      setPrefNote("");
      return;
    }
    try {
      setPrefNote(localStorage.getItem(notesKey(propertySlug, selected.key)) ?? "");
    } catch {
      setPrefNote("");
    }
  }, [selected?.key, propertySlug, prefTick]);

  const savePref = () => {
    if (!selected) return;
    try {
      localStorage.setItem(notesKey(propertySlug, selected.key), prefNote.trim());
      setPrefTick((n) => n + 1);
      toast.success("Desk note saved", { description: selected.name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save note");
    }
  };

  const exportCsv = () => {
    if (!selected || selectedStays.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = staysToCsv(selectedStays.map(stayMoney));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.name.replace(/[^\w.-]+/g, "_")}-stays.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported", { description: `${selectedStays.length} stay(s)` });
  };

  const printDossier = () => {
    if (!selected) return;
    try {
      const rows = selectedStays
        .map((s) => {
          const t = folioTotals(s);
          return `<tr>
          <td>${escapePrintHtml(s.confirmationNo)}</td>
          <td>${escapePrintHtml(s.guestName)}</td>
          <td>${escapePrintHtml(s.checkIn)} → ${escapePrintHtml(s.checkOut)}</td>
          <td>${escapePrintHtml(s.roomNumber ?? "—")}</td>
          <td>${escapePrintHtml(s.status)}</td>
          <td style="text-align:right">${t.charged.toFixed(2)}</td>
          <td style="text-align:right">${t.paid.toFixed(2)}</td>
          <td style="text-align:right">${t.balance.toFixed(2)}</td>
        </tr>`;
        })
        .join("");
      printHtmlDocument(
        `<!doctype html><html><head><title>${escapePrintHtml(selected.name)} · Guests CRM</title>
<style>
  body{font-family:Georgia,serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 6px}
  .meta{color:#555;font-size:13px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px 8px}
  th{background:#f4f4f4;text-align:left}
  .kpis{display:flex;gap:16px;margin:12px 0 18px;font-size:13px}
</style></head><body>
<h1>${escapePrintHtml(selected.name)}</h1>
<div class="meta">${escapePrintHtml(propertySlug)} · ${escapePrintHtml(fromDate || "any")} → ${escapePrintHtml(toDate || "any")} · ${selectedStays.length} stay(s)</div>
<div class="kpis">
  <div><strong>Total</strong> Nu ${money.charged.toFixed(2)}</div>
  <div><strong>Paid</strong> Nu ${money.paid.toFixed(2)}</div>
  <div><strong>Unpaid</strong> Nu ${money.unpaid.toFixed(2)}</div>
</div>
${prefNote.trim() ? `<p><strong>Desk notes</strong><br/>${escapePrintHtml(prefNote.trim())}</p>` : ""}
<table>
  <thead><tr><th>Conf</th><th>Guest</th><th>Stay</th><th>Rm</th><th>Status</th><th>Charged</th><th>Paid</th><th>Balance</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`,
        `${selected.name} · Guests CRM`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  return (
    <ModuleFrame
      title="Guests CRM"
      description="Agency / guest dossiers · stay money · date filter · export / print"
      actions={
        <>
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "vip", label: "VIP", swatch: "var(--hos-brass)" },
              { id: "freq", label: "Frequent", swatch: "var(--hos-primary)" },
              { id: "spend", label: "Spender", swatch: "var(--hos-emerald)" },
            ]}
          />
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!selected}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={printDossier} disabled={!selected}>
            Print
          </Button>
          <Link
            to="/reports?intel=guests"
            className="inline-flex min-h-9 items-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-[12px] font-semibold text-[var(--hos-ink-2)] no-underline"
            data-testid="guests-insights-link"
          >
            Insights
          </Link>
          <Button size="sm" onClick={() => openFastBook()}>
            Fast Book guest
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Profiles" value={dossiers.length} />
          <KpiCard label="VIP" value={dossiers.filter((d) => d.flag === "vip").length} />
          <KpiCard label="Frequent" value={dossiers.filter((d) => d.flag === "frequent").length} />
          <KpiCard
            label="Portfolio LTV"
            value={formatNu(dossiers.reduce((s, d) => s + d.ltv, 0))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <GlassPanel className="p-3.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, guest, conf #, room, companion…"
              className="w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                />
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                />
              </label>
            </div>
            <div className="mt-2 max-h-[520px] space-y-1.5 overflow-auto">
              {filtered.length === 0 ? (
                <EmptyState title="No guests" description="Widen dates or clear search." />
              ) : (
                filtered.map((d) => (
                  <motion.button
                    key={d.key}
                    type="button"
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    onClick={() => setSelectedKey(d.key)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selected?.key === d.key
                        ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.08)]"
                        : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-xs text-[var(--hos-ink)]">{d.name}</strong>
                      <Badge
                        tone={
                          d.flag === "vip"
                            ? "vip"
                            : d.flag === "spender"
                              ? "teal"
                              : d.flag === "frequent"
                                ? "default"
                                : "muted"
                        }
                      >
                        {d.flag}
                      </Badge>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[var(--hos-ink-3)]">
                      {d.passportOrCid || "—"} · {d.nationality || "—"}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold tabular-nums">
                      LTV {formatNu(d.ltv)} · {d.stays.length} stay(s)
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </GlassPanel>

          {selected ? (
            <GlassPanel className="p-4">
              <h2 className="m-0 text-lg font-bold text-[var(--hos-ink)]">{selected.name}</h2>
              <p className="mt-1 text-xs text-[var(--hos-ink-3)]">
                {selected.passportOrCid || "—"} · {selected.nationality || "—"} ·{" "}
                {selected.phone || "no phone"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={selected.vip ? "vip" : "muted"}>
                  {selected.vip ? "VIP" : "Standard"}
                </Badge>
                <Badge tone="teal">{selected.flag}</Badge>
                <Badge tone="default">LTV {formatNu(selected.ltv)}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <KpiCard label="Total" value={formatNu(money.charged)} />
                <KpiCard label="Paid" value={formatNu(money.paid)} />
                <KpiCard label="Unpaid" value={formatNu(money.unpaid)} />
              </div>

              <div className="mt-4 hos-cell rounded-xl p-3 text-xs">
                <strong>Preferences (desk notes)</strong>
                <textarea
                  className="mt-2 w-full resize-y rounded-lg border border-[var(--hos-line)] bg-[var(--hos-panel)] px-2.5 py-2 text-xs text-[var(--hos-ink)]"
                  rows={3}
                  placeholder="Pillow / floor / dietary / group ops notes…"
                  value={prefNote}
                  onChange={(e) => setPrefNote(e.target.value)}
                />
                <Button className="mt-2" size="sm" variant="secondary" onClick={savePref}>
                  Save note
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <strong className="block text-sm">
                  Stay history · {selectedStays.length}
                </strong>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={exportCsv}>
                    Export
                  </Button>
                  <Button size="sm" variant="ghost" onClick={printDossier}>
                    Print
                  </Button>
                </div>
              </div>
              <ul className="mt-2 m-0 list-none space-y-2 p-0">
                {selectedStays.length === 0 ? (
                  <li className="text-xs text-[var(--hos-ink-3)]">No stays in date range.</li>
                ) : (
                  selectedStays.map((s) => {
                    const t = folioTotals(s);
                    return (
                      <li
                        key={s.id}
                        className="hos-cell flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--hos-primary)]">
                            {s.confirmationNo} · {s.guestName}
                          </div>
                          <div className="text-[var(--hos-ink-3)]">
                            {s.checkIn} → {s.checkOut} · Rm {s.roomNumber ?? "—"} · {s.status}
                          </div>
                          <div className="mt-0.5 tabular-nums text-[10px] text-[var(--hos-ink-2)]">
                            Total {formatNu(t.charged)} · Paid {formatNu(t.paid)} · Bal{" "}
                            {formatNu(t.balance)}
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => openStay(s.id)}>
                          StayHub
                        </Button>
                      </li>
                    );
                  })
                )}
              </ul>
            </GlassPanel>
          ) : null}
        </div>
      </div>
    </ModuleFrame>
  );
}
