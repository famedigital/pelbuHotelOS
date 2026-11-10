import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  MorphTabs,
  StatusLegend,
} from "@hos-v2/ui";
import {
  formatNu,
  folioBalance,
  useFrontOfficeStore,
  type BookingStatus,
  type Stay,
} from "../lib/front-office-store";
import { runCommand } from "../lib/api";

type FilterTab =
  | "all"
  | "confirmed"
  | "held"
  | "checked_in"
  | "checked_out"
  | "cancelled";

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "held", label: "Held / Expiring" },
  { id: "checked_in", label: "Checked-In" },
  { id: "checked_out", label: "Checked-Out" },
  { id: "cancelled", label: "Cancelled" },
];

const FLAG: Record<string, string> = {
  French: "🇫🇷",
  German: "🇩🇪",
  Swiss: "🇨🇭",
  Singaporean: "🇸🇬",
  Bhutanese: "🇧🇹",
  Indian: "🇮🇳",
  Italian: "🇮🇹",
  American: "🇺🇸",
  British: "🇬🇧",
  Japanese: "🇯🇵",
};

function statusTone(
  status: BookingStatus,
): "success" | "vip" | "danger" | "default" | "muted" | "teal" {
  if (status === "checked_in") return "success";
  if (status === "held") return "vip";
  if (status === "cancelled" || status === "no_show") return "danger";
  if (status === "confirmed") return "default";
  if (status === "checked_out") return "muted";
  return "teal";
}

function matchesFilter(stay: Stay, filter: FilterTab): boolean {
  if (filter === "all") return true;
  if (filter === "held") return stay.status === "held";
  return stay.status === filter;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ReservationsPage() {
  const stays = useFrontOfficeStore((s) => s.stays);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    if (params.get("fastBook") === "1") {
      openFastBook();
      params.delete("fastBook");
      setParams(params, { replace: true });
    }
  }, [params, setParams, openFastBook]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stays
      .filter((s) => matchesFilter(s, filter))
      .filter((s) => sourceFilter === "all" || s.source === sourceFilter)
      .filter((s) => {
        if (!q) return true;
        return (
          s.guestName.toLowerCase().includes(q) ||
          s.confirmationNo.toLowerCase().includes(q) ||
          (s.roomNumber ?? "").includes(q) ||
          (s.groupName ?? "").toLowerCase().includes(q) ||
          s.guestPhone.includes(q)
        );
      })
      .sort(
        (a, b) =>
          b.checkIn.localeCompare(a.checkIn) ||
          a.guestName.localeCompare(b.guestName),
      );
  }, [stays, filter, query, sourceFilter]);

  const held = stays.filter((s) => s.status === "held").length;
  const inHouse = stays.filter((s) => s.status === "checked_in").length;
  const arriving = stays.filter((s) => s.status === "confirmed").length;
  const openBal = stays
    .filter((s) => s.status === "checked_in")
    .reduce((sum, s) => sum + Math.max(0, folioBalance(s)), 0);

  const exportManifest = async () => {
    const asOfDate = new Date().toISOString().slice(0, 10);
    let rows: string[][] = [];
    let source: "postgres" | "local_demo" = "local_demo";
    try {
      const api = await runCommand<{
        rows: Array<{
          confirmationNo: string;
          guestName: string;
          passportOrCid: string | null;
          nationality: string | null;
          checkIn: string;
          checkOut: string;
          roomNumber: string | null;
          guideLicense: string | null;
          vehiclePlate: string | null;
          status: string;
        }>;
      }>("compliance.immigrationManifest", { asOfDate });
      if (api.ok) {
        source = "postgres";
        rows = api.data.rows.map((r) => [
          r.confirmationNo,
          r.guestName,
          r.passportOrCid ?? "",
          r.nationality ?? "",
          r.checkIn,
          r.checkOut,
          r.roomNumber ?? "unassigned",
          r.status,
          r.guideLicense ?? "",
          r.vehiclePlate ?? "",
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Reservations] immigration API", { err: msg });
    }
    if (rows.length === 0) {
      rows = filtered.map((s) => [
        s.confirmationNo,
        s.guestName,
        s.passportOrCid,
        s.nationality,
        s.checkIn,
        s.checkOut,
        s.roomNumber ?? "unassigned",
        s.status,
        s.mealPlan,
        "",
      ]);
    }
    const csv = [
      "Ref,Guest,Passport/CID,Nationality,CheckIn,CheckOut,Room,Status,GuideLicense,VehiclePlate",
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tourist-manifest-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Tourist manifest exported", {
      description: `${rows.length} rows · ${source === "postgres" ? "API" : "local"} · Immigration / RBP`,
    });
  };

  return (
    <ModuleFrame
      title="Reservations"
      description="Avatar ledger · nationality flags · 1-tap StayHub / check-in"
      eyebrow="Master Hub"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "conf", label: "Confirmed", swatch: "var(--hos-primary)" },
              { id: "held", label: "Held", swatch: "var(--hos-brass)" },
              { id: "in", label: "In-house", swatch: "var(--hos-emerald)" },
              { id: "out", label: "Checked-out", swatch: "var(--hos-ink-3)" },
            ]}
          />
          <Button size="sm" variant="secondary" onClick={exportManifest}>
            Export Manifest
          </Button>
          <Button size="sm" onClick={() => openFastBook()}>
            Fast Book ⌘B
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Confirmed" value={arriving} delta="Awaiting arrival" />
        <KpiCard label="Holds" value={held} delta="Expire 18:00" />
        <KpiCard label="In-house" value={inHouse} delta="Live stays" />
        <KpiCard label="Open balances" value={formatNu(openBal)} delta="Guest folios" />
      </div>

      <GlassPanel className="flex flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guest, ref, room, group, phone…"
            className="w-full rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3.5 py-2 text-sm text-[var(--hos-ink)] outline-none focus:border-[var(--hos-primary)] lg:max-w-md"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs font-medium text-[var(--hos-ink)]"
          >
            <option value="all">All sources</option>
            <option value="direct">Direct</option>
            <option value="walk_in">Walk-in</option>
            <option value="agent">Agent</option>
            <option value="ota">OTA</option>
          </select>
        </div>

        <MorphTabs
          glowId="activeTabGlow"
          value={filter}
          onChange={setFilter}
          items={FILTERS}
        />

        {filtered.length === 0 ? (
          <EmptyState
            title="No reservations match"
            description="Adjust filters or create a booking with Fast Book."
            action={
              <Button size="sm" onClick={() => openFastBook()}>
                Fast Book
              </Button>
            }
          />
        ) : (
          <>
          <ul className="m-0 grid list-none gap-2 p-0 md:hidden">
            {filtered.map((s) => {
              const bal = folioBalance(s);
              const flag = FLAG[s.nationality] ?? "🏳️";
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openStay(s.id)}
                    className="hos-cell flex min-h-12 w-full flex-col gap-2 rounded-xl p-3 text-left active:bg-[rgba(37,99,235,0.06)]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--hos-primary),#6366f1)] text-[10px] font-bold text-white">
                        {initials(s.guestName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 font-semibold text-[var(--hos-ink)]">
                          <span className="truncate">{s.guestName}</span>
                          <span>{flag}</span>
                          {s.vip ? <Badge tone="vip">VIP</Badge> : null}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--hos-primary)]">
                          {s.confirmationNo}
                        </div>
                      </div>
                      <Badge tone={statusTone(s.status)}>
                        {s.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--hos-ink-3)]">
                      <span className="tabular-nums">
                        {s.checkIn} → {s.checkOut}
                      </span>
                      <span>
                        {s.roomNumber ? `Rm ${s.roomNumber}` : "unassigned"} · {s.mealPlan}
                      </span>
                      <span className="tabular-nums font-semibold text-[var(--hos-ink)]">
                        {formatNu(bal)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] md:block">
            <table className="w-full min-w-[720px] text-left text-xs lg:min-w-[980px]">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                  <th className="px-3 py-2.5">Ref</th>
                  <th className="px-3 py-2.5">Guest</th>
                  <th className="px-3 py-2.5">Dates</th>
                  <th className="px-3 py-2.5">Room</th>
                  <th className="px-3 py-2.5">Meal</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Balance</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)]">
                {filtered.map((s) => {
                  const bal = folioBalance(s);
                  const flag = FLAG[s.nationality] ?? "🏳️";
                  return (
                    <tr key={s.id} className="group hover:bg-[rgba(37,99,235,0.04)]">
                      <td className="px-3 py-2.5 font-mono font-semibold text-[var(--hos-primary)]">
                        {s.confirmationNo}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--hos-primary),#6366f1)] text-[10px] font-bold text-white">
                            {initials(s.guestName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1 font-semibold text-[var(--hos-ink)]">
                              <span className="truncate">{s.guestName}</span>
                              <span title={s.nationality}>{flag}</span>
                              {s.vip ? <Badge tone="vip">VIP</Badge> : null}
                            </div>
                            {s.groupName ? (
                              <div className="truncate text-[10px] text-[var(--hos-teal)]">
                                {s.groupName}
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--hos-ink-3)]">
                                {s.passportOrCid}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[var(--hos-ink-2)]">
                        {s.checkIn} → {s.checkOut}
                      </td>
                      <td className="px-3 py-2.5">
                        {s.roomNumber ? (
                          <span className="rounded-md bg-[rgba(37,99,235,0.1)] px-2 py-0.5 font-mono font-bold text-[var(--hos-primary)]">
                            {s.roomNumber}
                          </span>
                        ) : (
                          <span className="text-[var(--hos-ruby)]">unassigned</span>
                        )}
                        <div className="mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
                          {s.typeCode}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          {s.mealPlan}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-[var(--hos-ink-2)]">
                        {s.source.replace("_", " ")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`size-1.5 rounded-full ${
                              s.status === "checked_in"
                                ? "bg-[var(--hos-emerald)]"
                                : s.status === "held"
                                  ? "bg-[var(--hos-brass)]"
                                  : s.status === "cancelled"
                                    ? "bg-[var(--hos-ruby)]"
                                    : "bg-[var(--hos-primary)]"
                            }`}
                          />
                          <Badge tone={statusTone(s.status)}>
                            {s.status.replace("_", " ")}
                          </Badge>
                        </span>
                        {s.holdExpiresAt ? (
                          <div className="mt-0.5 text-[10px] text-[var(--hos-brass-ink)]">
                            exp {s.holdExpiresAt.slice(11, 16)}
                          </div>
                        ) : null}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          bal > 0 ? "text-[var(--hos-ruby)]" : "text-[var(--hos-emerald)]"
                        }`}
                      >
                        {formatNu(bal)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100">
                          {["confirmed", "held"].includes(s.status) && s.roomId ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                void (async () => {
                                  const res = await checkIn(s.id);
                                  if (!res.ok) toast.error(res.error);
                                  else toast.success(`Checked in · Rm ${s.roomNumber}`);
                                })();
                              }}
                            >
                              ⚡ In
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openStay(s.id);
                            }}
                          >
                            StayHub
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </GlassPanel>
    </div>
    </ModuleFrame>
  );
}
