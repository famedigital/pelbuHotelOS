import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, GlassPanel, KpiCard, ModuleFrame } from "@hos-v2/ui";
import {
  folioBalance,
  formatNu,
  useFrontOfficeStore,
  type Stay,
} from "../lib/front-office-store";

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

export function GuestsPage() {
  const reduce = useReducedMotion();
  const stays = useFrontOfficeStore((s) => s.stays);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const [q, setQ] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const dossiers = useMemo(() => {
    const map = new Map<string, GuestDossier>();
    for (const s of stays) {
      const key = s.passportOrCid || s.guestName;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: s.guestName,
          nationality: s.nationality,
          passportOrCid: s.passportOrCid,
          phone: s.guestPhone,
          email: s.guestEmail,
          vip: s.vip,
          stays: [s],
          ltv: Math.max(0, -folioBalance(s)) + s.depositPaid + s.nightlyNet,
          flag: s.vip ? "vip" : "normal",
        });
      } else {
        existing.stays.push(s);
        existing.vip = existing.vip || s.vip;
        existing.ltv += s.depositPaid + s.nightlyNet;
      }
    }
    for (const d of map.values()) {
      if (d.stays.length >= 2) d.flag = d.vip ? "vip" : "frequent";
      if (d.ltv > 40000) d.flag = d.vip ? "vip" : "spender";
      if (d.vip) d.flag = "vip";
    }
    return [...map.values()].sort((a, b) => b.ltv - a.ltv);
  }, [stays]);

  const filtered = dossiers.filter((d) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      d.name.toLowerCase().includes(needle) ||
      d.passportOrCid.toLowerCase().includes(needle) ||
      d.nationality.toLowerCase().includes(needle) ||
      d.phone.includes(needle)
    );
  });

  const selected = filtered.find((d) => d.key === selectedKey) ?? filtered[0] ?? null;

  return (
    <ModuleFrame
      title="Guests CRM"
      description="CID/Passport dossiers · LTV · VIP / frequent / spender flags · stay history"
      actions={
        <>
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            Identity Vault
          </Badge>
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
            placeholder="Search name, CID, passport, phone…"
            className="w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
          />
          <div className="mt-2 max-h-[520px] space-y-1.5 overflow-auto">
            {filtered.length === 0 ? (
              <EmptyState title="No guests" description="Create a booking to seed CRM." />
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
                    {d.passportOrCid} · {d.nationality}
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
              {selected.passportOrCid} · {selected.nationality} · {selected.phone || "no phone"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={selected.vip ? "vip" : "muted"}>
                {selected.vip ? "VIP" : "Standard"}
              </Badge>
              <Badge tone="teal">{selected.flag}</Badge>
              <Badge tone="default">LTV {formatNu(selected.ltv)}</Badge>
            </div>
            <div className="mt-4 hos-cell rounded-xl p-3 text-xs">
              <strong>Preferences (desk notes)</strong>
              <p className="m-0 mt-1 text-[var(--hos-ink-3)]">
                Pillow / floor / dietary captured on StayHub rooming & group lists. Encrypted
                document vault hooks to Immigrations pack at night audit.
              </p>
            </div>
            <strong className="mt-4 block text-sm">Stay history</strong>
            <ul className="mt-2 m-0 list-none space-y-2 p-0">
              {selected.stays.map((s) => (
                <li key={s.id} className="hos-cell flex items-center justify-between rounded-xl px-3 py-2 text-xs">
                  <div>
                    <div className="font-semibold text-[var(--hos-primary)]">{s.confirmationNo}</div>
                    <div className="text-[var(--hos-ink-3)]">
                      {s.checkIn} → {s.checkOut} · Rm {s.roomNumber ?? "—"} · {s.status}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openStay(s.id)}>
                    StayHub
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-3"
              size="sm"
              variant="ghost"
              onClick={() =>
                toast.success("Immigration dossier pack queued", {
                  description: "CID/Passport images · encrypted vault export",
                })
              }
            >
              Export identity pack
            </Button>
          </GlassPanel>
        ) : null}
      </div>
    </div>
    </ModuleFrame>
  );
}
