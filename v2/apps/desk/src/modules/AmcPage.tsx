import { Badge, GlassPanel, KpiCard, SpotlightCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";

function daysUntil(ymd: string): number {
  return Math.ceil(
    (new Date(`${ymd}T12:00:00`).getTime() - Date.now()) / 86400000,
  );
}

export function AmcPage() {
  const amc = useEnterpriseOpsStore((s) => s.amc);
  const alerting = amc.filter((c) => daysUntil(c.endsOn) <= c.alertDays);

  return (
    <ModuleFrame
      title="AMC Contracts"
      description="Lift · gen · boiler renewal alerts"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "ok", label: "Active", swatch: "var(--hos-emerald)" },
            { id: "warn", label: "Renew soon", swatch: "var(--hos-brass)" },
            { id: "exp", label: "Expiring", swatch: "var(--hos-ruby)" },
          ]}
        />
      }
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">
            AMC Contracts
          </h1>
          <Badge tone="default">Lift · Gen · Boiler</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Annual maintenance contracts with renewal alerts (default 45 days)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Active contracts" value={amc.length} />
        <KpiCard label="In alert window" value={alerting.length} delta="≤45d" />
        <KpiCard
          label="Next expiry"
          value={
            amc
              .slice()
              .sort((a, b) => a.endsOn.localeCompare(b.endsOn))[0]
              ?.endsOn ?? "—"
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {amc.map((c) => {
          const d = daysUntil(c.endsOn);
          const alert = d <= c.alertDays;
          return (
            <SpotlightCard key={c.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-sm">{c.assetKind}</strong>
                <Badge tone={alert ? "vip" : "success"}>
                  {alert ? `${d}d left` : "OK"}
                </Badge>
              </div>
              <p className="m-0 mt-1 text-xs text-[var(--hos-ink-2)]">
                {c.vendorName}
              </p>
              <div className="hos-cell mt-3 rounded-xl p-2.5 text-[11px]">
                Ends {c.endsOn} · alert {c.alertDays}d before
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      {alerting.length > 0 ? (
        <GlassPanel className="p-3.5">
          <strong className="text-sm">Renewal queue</strong>
          <ul className="m-0 mt-2 list-disc pl-5 text-xs text-[var(--hos-ink-2)]">
            {alerting.map((c) => (
              <li key={c.id}>
                {c.assetKind} · {c.vendorName} · ends {c.endsOn}
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : null}
    </div>
    </ModuleFrame>
  );
}
