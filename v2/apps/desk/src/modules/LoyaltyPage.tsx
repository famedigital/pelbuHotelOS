import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard,
  ModuleFrame,
} from "@hos-v2/ui";
import { useExtrasStore } from "../lib/extras-store";

const TIER_LABEL = { druk_gold: "Druk Gold", tashi_silver: "Tashi Silver", norbu: "Norbu Member" } as const;

export function LoyaltyPage() {
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const loyalty = useExtrasStore((s) => s.loyalty);
  const issueVoucher = useExtrasStore((s) => s.issueVoucher);
  const enrolLoyalty = useExtrasStore((s) => s.enrolLoyalty);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [burn, setBurn] = useState(500);
  const [selectedId, setSelectedId] = useState(loyalty[0]?.id ?? "");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return loyalty;
    return loyalty.filter((m) => m.name.toLowerCase().includes(n) || m.phone.includes(n));
  }, [loyalty, q]);
  const selected = loyalty.find((m) => m.id === selectedId) ?? filtered[0];

  return (
    <ModuleFrame
      title="Loyalty"
      description="Druk · Tashi · Norbu points ledger"
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">Loyalty</h1>
          <Badge tone="vip">Druk · Tashi · Norbu</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Points & nights ledger · direct booking discounts · instant reward vouchers
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Members" value={loyalty.length} />
        <KpiCard label="Druk Gold" value={loyalty.filter((m) => m.tier === "druk_gold").length} />
        <KpiCard label="Points out" value={loyalty.reduce((s, m) => s + m.points, 0).toLocaleString()} />
        <KpiCard label="Direct book rule" value="1.2×" delta="vs OTA earn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <GlassPanel className="p-3.5">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search member / phone…" className="w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs" />
          <div className="mt-2 max-h-[420px] space-y-1.5 overflow-auto">
            {filtered.map((m) => (
              <button key={m.id} type="button" onClick={() => setSelectedId(m.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === m.id ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.08)]" : "border-[var(--hos-line)] bg-[var(--hos-cell)]"}`}>
                <div className="flex justify-between gap-2">
                  <strong className="text-xs">{m.name}</strong>
                  <Badge tone={m.tier === "druk_gold" ? "vip" : m.tier === "tashi_silver" ? "default" : "muted"}>{TIER_LABEL[m.tier]}</Badge>
                </div>
                <div className="mt-1 text-[10px] text-[var(--hos-ink-3)]">{m.points.toLocaleString()} pts · {m.nights} nights</div>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 border-t border-[var(--hos-line)] pt-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New member name" className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs" />
            <Button size="sm" onClick={() => {
              if (!name.trim()) { toast.error("Name required"); return; }
              const m = enrolLoyalty(name, phone);
              setSelectedId(m.id);
              setName("");
              toast.success(`${m.name} enrolled as Norbu`);
            }}>Enrol Norbu</Button>
          </div>
        </GlassPanel>

        {selected ? (
          <GlassPanel className="p-4">
            <h2 className="m-0 text-lg font-bold">{selected.name}</h2>
            <p className="text-xs text-[var(--hos-ink-3)]">{selected.phone} · {TIER_LABEL[selected.tier]}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="hos-cell rounded-xl p-3"><div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Points</div><strong className="text-xl tabular-nums">{selected.points.toLocaleString()}</strong></div>
              <div className="hos-cell rounded-xl p-3"><div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Stay nights</div><strong className="text-xl tabular-nums">{selected.nights}</strong></div>
            </div>
            <p className="mt-3 text-xs text-[var(--hos-ink-2)]">Earn: 10 pts / Nu.100 room net · Direct book 1.2× · Gold 15% off BAR · Silver 10% · Norbu 5%.</p>
            <label className="mt-3 grid gap-1 text-xs font-medium">Burn points for voucher
              <input type="number" value={burn} onChange={(e) => setBurn(Number(e.target.value) || 0)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
            </label>
            <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
              <Button className="mt-2" onClick={() => {
                start(() => {
                  const res = issueVoucher(selected.id, burn);
                  if (!res.ok) toast.error(res.error);
                  else toast.success(`Voucher ${res.code}`, { description: `${burn} pts redeemed` });
                });
              }}>Issue reward voucher</Button>
            </motion.div>
          </GlassPanel>
        ) : null}
      </div>
    </div>
    </ModuleFrame>
  );
}
