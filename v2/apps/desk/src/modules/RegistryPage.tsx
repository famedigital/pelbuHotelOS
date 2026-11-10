import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  GlassPanel,
  KpiCard,
  MorphTabs,
  SpotlightCard,
  ModuleFrame,
} from "@hos-v2/ui";
import { formatNu } from "../lib/front-office-store";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import { useExtrasStore, type VehicleReg } from "../lib/extras-store";
import { MarketplaceDeskPanel } from "./field/MarketplaceDeskPanel";

function daysUntil(ymd: string): number {
  const a = new Date(`${ymd}T12:00:00`).getTime();
  const b = Date.now();
  return Math.ceil((a - b) / 86400000);
}

function ExpiryBadge({ label, ymd }: { label: string; ymd: string }) {
  const d = daysUntil(ymd);
  const tone = d < 0 ? "danger" : d <= 45 ? "vip" : "success";
  return (
    <Badge tone={tone}>
      {label} {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`}
    </Badge>
  );
}

function VehicleCard({ v }: { v: VehicleReg }) {
  const typeLabel =
    v.type === "coaster" ? "Coaster Bus" : v.type === "hiace" ? "HiAce" : "SUV";
  const lastFuel = v.fuelLogs[0];

  return (
    <SpotlightCard className="p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-bold text-[var(--hos-primary)]">
            {v.plate}
          </div>
          <div className="mt-0.5 text-xs text-[var(--hos-ink-2)]">
            {typeLabel} · {v.seats} seats
          </div>
        </div>
        <Badge tone="teal">{v.dormBed}</Badge>
      </div>
      <p className="m-0 mt-2 text-xs font-semibold text-[var(--hos-ink)]">
        Driver · {v.driver}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ExpiryBadge label="RSTA" ymd={v.rstaExpiry} />
        <ExpiryBadge label="Insurance" ymd={v.insuranceExpiry} />
      </div>
      <div className="hos-cell mt-3 rounded-xl p-2.5 text-[11px]">
        <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Last fuel top-up</div>
        {lastFuel ? (
          <p className="m-0 mt-1 text-[var(--hos-ink-2)]">
            {lastFuel.litres} L · {formatNu(lastFuel.amountNu)} · {lastFuel.station} ·{" "}
            {new Date(lastFuel.at).toLocaleDateString()}
          </p>
        ) : (
          <p className="m-0 mt-1 text-[var(--hos-ink-3)]">No fuel log yet</p>
        )}
      </div>
    </SpotlightCard>
  );
}

export function RegistryPage() {
  const [tab, setTab] = useState<"marketplace" | "guides" | "vehicles">(
    "marketplace",
  );
  const [gName, setGName] = useState("");
  const [gTcr, setGTcr] = useState("");
  const [gPhone, setGPhone] = useState("");
  const guides = useExtrasStore((s) => s.guides);
  const vehicles = useExtrasStore((s) => s.vehicles);
  const upsertGuide = useExtrasStore((s) => s.upsertGuide);
  const amc = useEnterpriseOpsStore((s) => s.amc);

  const voucherActive = guides.filter((g) => g.mealVoucherActive).length;
  const beds = useMemo(
    () => guides.filter((g) => g.guideBed).length + vehicles.length,
    [guides, vehicles],
  );
  const amcAlerts = amc.filter((c) => daysUntil(c.endsOn) <= c.alertDays);

  return (
    <ModuleFrame
      title="Guides & Fleet Marketplace"
      description="Innora-wide find · requests · TCB registry · opaque room commissions"
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">
            Guides & Fleet
          </h1>
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            Marketplace
          </Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Find free guides & cars Innora-wide · post needs · licence directory
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Guides" value={guides.length} delta="Directory" />
        <KpiCard
          label="Verified TCR"
          value={guides.filter((g) => g.verified).length}
          delta="DRC / TCB"
        />
        <KpiCard label="Fleet units" value={vehicles.length} delta="BP plates" />
        <KpiCard label="Beds / vouchers" value={`${beds} / ${voucherActive}`} delta="Ops" />
      </div>

      {amcAlerts.length > 0 ? (
        <GlassPanel className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="vip">AMC renewals</Badge>
            {amcAlerts.map((c) => (
              <span key={c.id} className="text-[var(--hos-ink-2)]">
                {c.assetKind} · {c.endsOn}
              </span>
            ))}
          </div>
        </GlassPanel>
      ) : null}

      <MorphTabs
        glowId="activeTabGlow"
        value={tab}
        onChange={setTab}
        size="md"
        className="w-fit"
        items={[
          { id: "marketplace", label: "Find & requests" },
          { id: "guides", label: "Licensed Tour Guides", count: guides.length },
          { id: "vehicles", label: "Transport & Drivers", count: vehicles.length },
        ]}
      />

      {tab === "marketplace" ? (
        <MarketplaceDeskPanel postedBy="hotel" posterLabel="Demo Hotel FO" />
      ) : null}

      {tab === "guides" ? (
        <>
        <GlassPanel className="grid gap-2 p-3 sm:grid-cols-4">
          <input
            value={gName}
            onChange={(e) => setGName(e.target.value)}
            placeholder="Guide name"
            className="hos-cell rounded-lg px-2 py-2 text-xs"
          />
          <input
            value={gTcr}
            onChange={(e) => setGTcr(e.target.value)}
            placeholder="TCR license #"
            className="hos-cell rounded-lg px-2 py-2 font-mono text-xs"
          />
          <input
            value={gPhone}
            onChange={(e) => setGPhone(e.target.value)}
            placeholder="Phone"
            className="hos-cell rounded-lg px-2 py-2 text-xs"
          />
          <Button
            size="sm"
            onClick={() => {
              if (!gName.trim() || !gTcr.trim()) {
                toast.error("Name and TCR required");
                return;
              }
              const g = upsertGuide({
                name: gName,
                tcr: gTcr,
                phone: gPhone,
                languages: "Dzongkha · English",
              });
              setGName("");
              setGTcr("");
              setGPhone("");
              toast.success(`${g.name} added to registry`);
            }}
          >
            Add guide
          </Button>
        </GlassPanel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {guides.map((g) => (
            <SpotlightCard key={g.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--hos-primary),#6366f1)] text-sm font-bold text-white">
                  {g.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-sm text-[var(--hos-ink)]">{g.name}</strong>
                    <Badge tone={g.verified ? "success" : "vip"}>
                      {g.verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs font-semibold text-[var(--hos-primary)]">
                    {g.tcr}
                  </div>
                  <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-3)]">
                    {g.languages}
                  </p>
                  <p className="m-0 mt-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                    Emergency · {g.phone}
                  </p>
                </div>
              </div>

              <div className="hos-cell mt-3 rounded-xl p-2.5">
                <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">
                  Active tours linked
                </div>
                {g.activeTours.length === 0 ? (
                  <p className="m-0 mt-1 text-xs text-[var(--hos-ink-3)]">No active delegation</p>
                ) : (
                  <ul className="m-0 mt-1 list-none space-y-1 p-0">
                    {g.activeTours.map((t) => (
                      <li key={t} className="text-xs font-semibold text-[var(--hos-teal)]">
                        👥 {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={g.mealVoucherActive ? "success" : "muted"}>
                  {g.mealVoucherActive ? "Staff meal voucher ON" : "No meal voucher"}
                </Badge>
                <Badge tone="default">{g.guideBed ?? "No guide bed"}</Badge>
              </div>
            </SpotlightCard>
          ))}
        </div>
        </>
      ) : tab === "vehicles" ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} v={v} />
            ))}
          </div>
          <GlassPanel className="overflow-x-auto p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Fleet maintenance log</strong>
            <table className="mt-3 w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                  <th className="px-2 py-2">Plate</th>
                  <th className="px-2 py-2">Driver dorm</th>
                  <th className="px-2 py-2">RSTA</th>
                  <th className="px-2 py-2">Insurance</th>
                  <th className="px-2 py-2">Fuel entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)]">
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="px-2 py-2 font-mono font-bold">{v.plate}</td>
                    <td className="px-2 py-2">{v.dormBed}</td>
                    <td className="px-2 py-2">{v.rstaExpiry}</td>
                    <td className="px-2 py-2">{v.insuranceExpiry}</td>
                    <td className="px-2 py-2 tabular-nums">{v.fuelLogs.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>
        </div>
      ) : null}

      {tab !== "marketplace" ? (
      <Button
        size="sm"
        variant="secondary"
        className="w-fit"
        onClick={() =>
          toast.success("TCR / RSTA validation queued", {
            description: "TCB license + roadworthiness ping",
          })
        }
      >
        Re-validate licenses & RSTA
      </Button>
      ) : null}
    </div>
    </ModuleFrame>
  );
}
