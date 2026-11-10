import { Package, Plus, Minus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
  MorphTabs,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { formatNu } from "../lib/front-office-store";
import {
  lowStockSkus,
  useInventoryStore,
  type StockSku,
} from "../lib/inventory-store";

type CatFilter = "all" | StockSku["category"];

export function StockPage() {
  const [, start] = useTransition();
  const skus = useInventoryStore((s) => s.skus);
  const movements = useInventoryStore((s) => s.movements);
  const adjustStock = useInventoryStore((s) => s.adjustStock);

  const [cat, setCat] = useState<CatFilter>("all");
  const [adjustSkuId, setAdjustSkuId] = useState(skus[0]?.id ?? "");
  const [adjustDelta, setAdjustDelta] = useState("-1");
  const [adjustReason, setAdjustReason] = useState<"waste" | "count" | "adjust">(
    "waste",
  );
  const [adjustNote, setAdjustNote] = useState("");

  const low = useMemo(() => lowStockSkus(skus), [skus]);
  const filtered = useMemo(
    () => (cat === "all" ? skus : skus.filter((s) => s.category === cat)),
    [skus, cat],
  );
  const onHandValue = skus.reduce((s, x) => s + x.onHand, 0);

  return (
    <ModuleFrame
      title="Stock on-hand"
      description="SKU levels · waste · count adjustments"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "ok", label: "OK", swatch: "var(--hos-emerald)" },
            { id: "low", label: "Low", swatch: "var(--hos-brass)" },
            { id: "out", label: "Out", swatch: "var(--hos-ruby)" },
          ]}
        />
      }
    >
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="size-5 text-[var(--hos-primary)]" aria-hidden />
            <h1 className="m-0 text-2xl font-bold tracking-tight text-[var(--hos-ink)]">
              Stock on-hand
            </h1>
            <Badge tone="teal">F&B · HK</Badge>
          </div>
          <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
            Purchase GRN receives · waste / count adjustments · reorder pulse
          </p>
        </div>
        <Link
          to="/purchases"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs font-semibold text-[var(--hos-primary)]"
        >
          Purchase / GRN entry →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="SKUs" value={skus.length} delta="Seeded catalog" />
        <KpiCard label="Low stock" value={low.length} delta="At/below reorder" />
        <KpiCard label="Sum on-hand" value={Math.round(onHandValue)} delta="All UOMs" />
        <KpiCard label="Movements" value={movements.length} delta="Recent" />
      </div>

      <MorphTabs
        glowId="stockCatGlow"
        value={cat}
        onChange={setCat}
        items={[
          { id: "all", label: "All" },
          { id: "kitchen", label: "Kitchen" },
          { id: "bar", label: "Bar" },
          { id: "housekeeping", label: "HK" },
          { id: "other", label: "Other" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <GlassPanel className="overflow-x-auto p-3.5">
          {filtered.length === 0 ? (
            <EmptyState title="No SKUs" description="Change category filter." />
          ) : (
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2 text-right">On hand</th>
                  <th className="px-2 py-2 text-right">Reorder</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)]">
                {filtered.map((s) => {
                  const lowHit = s.onHand <= s.reorderAt;
                  return (
                    <tr key={s.id}>
                      <td className="px-2 py-2 font-mono text-[11px]">{s.code}</td>
                      <td className="px-2 py-2">
                        <strong className="text-[var(--hos-ink)]">{s.name}</strong>
                        <div className="text-[10px] capitalize text-[var(--hos-ink-3)]">
                          {s.category}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {s.onHand} {s.uom}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-3)]">
                        {s.reorderAt}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={lowHit ? "danger" : "success"}>
                          {lowHit ? "Reorder" : "OK"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </GlassPanel>

        <div className="flex flex-col gap-3">
          <GlassPanel className="flex flex-col gap-2 p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Manual adjustment</strong>
            <label className="grid gap-1 text-[11px] font-medium">
              SKU
              <select
                value={adjustSkuId}
                onChange={(e) => setAdjustSkuId(e.target.value)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
              >
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-medium">
                Delta
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-medium">
                Reason
                <select
                  value={adjustReason}
                  onChange={(e) =>
                    setAdjustReason(e.target.value as "waste" | "count" | "adjust")
                  }
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
                >
                  <option value="waste">Waste</option>
                  <option value="count">Count</option>
                  <option value="adjust">Adjust</option>
                </select>
              </label>
            </div>
            <input
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Note (required)"
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setAdjustDelta((d) => String(-(Math.abs(Number(d) || 1))))
                }
              >
                <Minus className="mr-1 size-3.5" />
                Out
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setAdjustDelta((d) => String(Math.abs(Number(d) || 1)))
                }
              >
                <Plus className="mr-1 size-3.5" />
                In
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  start(() => {
                    const res = adjustStock({
                      skuId: adjustSkuId,
                      delta: Number(adjustDelta) || 0,
                      reason: adjustReason,
                      note: adjustNote,
                    });
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success("Stock adjusted");
                      setAdjustNote("");
                    }
                  });
                }}
              >
                Post
              </Button>
            </div>
          </GlassPanel>

          <GlassPanel className="max-h-72 overflow-auto p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Recent movements</strong>
            {movements.length === 0 ? (
              <p className="mt-2 m-0 text-[11px] text-[var(--hos-ink-3)]">
                Receive via Purchases GRN or post an adjustment.
              </p>
            ) : (
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                {movements.slice(0, 12).map((m) => {
                  const sku = skus.find((s) => s.id === m.skuId);
                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-[var(--hos-line)] px-2 py-1.5 text-[11px]"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[var(--hos-ink)]">
                          {sku?.code ?? m.skuId}
                        </span>
                        <span
                          className={`font-mono tabular-nums ${
                            m.delta >= 0
                              ? "text-[var(--hos-emerald)]"
                              : "text-[var(--hos-ruby)]"
                          }`}
                        >
                          {m.delta >= 0 ? "+" : ""}
                          {m.delta}
                        </span>
                      </div>
                      <div className="text-[var(--hos-ink-3)]">
                        {m.reason}
                        {m.ref ? ` · ${m.ref}` : ""} · {m.note}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassPanel>
        </div>
      </div>

      {low.length ? (
        <GlassPanel className="p-3.5">
          <strong className="text-sm text-[var(--hos-ruby)]">
            Reorder pulse · {low.length} SKU(s)
          </strong>
          <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-3)]">
            {low.map((s) => `${s.code} (${s.onHand}${s.uom})`).join(" · ")} — post a
            purchase with GRN lines (~
            {formatNu(0)} desk demo).
          </p>
        </GlassPanel>
      ) : null}
    </div>
    </ModuleFrame>
  );
}
