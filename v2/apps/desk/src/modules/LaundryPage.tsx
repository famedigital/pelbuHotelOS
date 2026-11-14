import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { formatNu, taxBreakdown, useFrontOfficeStore } from "../lib/front-office-store";
import {
  CATALOG_GARMENTS,
  GARMENT_LABEL,
  GARMENT_RATES,
  catalogLineDefaults,
  laundryBagDescription,
  laundryBagPreviewNet,
  SERVICE_LABEL,
  useOpsStore,
  type GarmentKind,
  type LaundryGarmentLine,
  type LaundryService,
  type LaundrySpeed,
} from "../lib/ops-store";

type DraftLine = LaundryGarmentLine;

type PickKind = GarmentKind | "custom" | "";

function emptyDraftLines(): DraftLine[] {
  return [];
}

export function LaundryPage() {
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const stays = useFrontOfficeStore((s) => s.stays);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const bags = useOpsStore((s) => s.bags);
  const intakeBag = useOpsStore((s) => s.intakeBag);
  const advanceBag = useOpsStore((s) => s.advanceBag);
  const postBagToFolio = useOpsStore((s) => s.postBagToFolio);

  const inHouse = stays.filter((s) => s.status === "checked_in");
  const [stayId, setStayId] = useState(inHouse[0]?.id ?? "");
  const [service, setService] = useState<LaundryService>("wash_iron");
  const [speed, setSpeed] = useState<LaundrySpeed>("normal");
  const [lines, setLines] = useState<DraftLine[]>(emptyDraftLines);
  const [pickKind, setPickKind] = useState<PickKind>("");
  const [pickQty, setPickQty] = useState(1);
  const [customLabel, setCustomLabel] = useState("");
  const [customRate, setCustomRate] = useState("");

  const previewNet = useMemo(
    () => laundryBagPreviewNet(lines, service, speed),
    [lines, service, speed],
  );
  const previewTax = taxBreakdown(previewNet);
  const isCustom = pickKind === "custom";

  const addLine = () => {
    const qty = Math.max(1, Math.floor(pickQty) || 1);
    if (!pickKind) {
      toast.error("Choose a cloth type");
      return;
    }
    if (pickKind === "custom") {
      const label = customLabel.trim();
      const unitNet = Math.round(Number(customRate) || 0);
      if (!label) {
        toast.error("Name the custom cloth");
        return;
      }
      if (unitNet <= 0) {
        toast.error("Enter a rate in Nu");
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: "custom",
          label,
          qty,
          unitNet,
        },
      ]);
      setCustomLabel("");
      setCustomRate("");
      setPickKind("");
      setPickQty(1);
      return;
    }

    const defaults = catalogLineDefaults(pickKind);
    setLines((prev) => {
      const existing = prev.find((l) => l.kind === pickKind);
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: defaults.kind,
          label: defaults.label,
          qty,
          unitNet: defaults.unitNet,
        },
      ];
    });
    setPickKind("");
    setPickQty(1);
  };

  const bumpQty = (id: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const openBags = bags.filter((b) => b.status !== "posted").length;
  const express = bags.filter((b) => b.speed === "express" && b.status !== "posted").length;

  return (
    <ModuleFrame
      title="Laundry & Valet"
      description="Pull items from the bag · dropdown intake · folio post"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "open", label: "Open", swatch: "var(--hos-primary)" },
            { id: "express", label: "Express", swatch: "var(--hos-brass)" },
            { id: "posted", label: "Posted", swatch: "var(--hos-emerald)" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Open bags" value={openBags} delta="In plant" />
          <KpiCard label="Express" value={express} delta="4h SLA" />
          <KpiCard
            label="Posted today"
            value={bags.filter((b) => b.status === "posted").length}
          />
          <KpiCard
            label="Preview all-in"
            value={formatNu(previewTax.totalAmount)}
            delta="SC+BST"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
          <GlassPanel className="flex flex-col gap-3 p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Digital bag intake</strong>
            <label className="grid gap-1 text-xs font-medium text-[var(--hos-ink-2)]">
              In-house guest
              <select
                value={stayId}
                onChange={(e) => setStayId(e.target.value)}
                className="min-h-11 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
              >
                <option value="">Select…</option>
                {inHouse.map((s) => (
                  <option key={s.id} value={s.id}>
                    Rm {s.roomNumber} · {s.guestName}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SERVICE_LABEL) as LaundryService[]).map((s) => (
                <motion.button
                  key={s}
                  type="button"
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  onClick={() => setService(s)}
                  className={`min-h-10 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                    service === s
                      ? "bg-[var(--hos-primary)] text-white"
                      : "border border-[var(--hos-line)] bg-[var(--hos-cell)]"
                  }`}
                >
                  {SERVICE_LABEL[s]}
                </motion.button>
              ))}
            </div>

            <div className="flex gap-2">
              {(["normal", "express"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-semibold capitalize ${
                    speed === s
                      ? "border border-[var(--hos-primary)]/40 bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
                      : "border border-[var(--hos-line)]"
                  }`}
                >
                  {s} {s === "express" ? "(+50%)" : "(24h)"}
                </button>
              ))}
            </div>

            <div className="hos-cell flex flex-col gap-2 rounded-xl p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                Add item from bag
              </span>
              <div className="flex flex-wrap gap-2">
                <select
                  value={pickKind}
                  onChange={(e) => setPickKind(e.target.value as PickKind)}
                  className="min-h-11 min-w-[10rem] flex-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
                >
                  <option value="">Select cloth…</option>
                  {CATALOG_GARMENTS.map((g) => (
                    <option key={g} value={g}>
                      {GARMENT_LABEL[g]} · {formatNu(GARMENT_RATES[g])}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={pickQty}
                  onChange={(e) => setPickQty(Number(e.target.value) || 1)}
                  aria-label="Quantity"
                  className="min-h-11 w-16 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs tabular-nums"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="!min-h-11"
                  onClick={addLine}
                >
                  Add to bag
                </Button>
              </div>
              {isCustom ? (
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Custom cloth name"
                    className="min-h-11 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    placeholder="Nu rate"
                    aria-label="Custom rate Nu"
                    className="min-h-11 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs tabular-nums"
                  />
                </div>
              ) : null}
            </div>

            {lines.length === 0 ? (
              <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
                Pull items from the bag — choose a cloth type below.
              </p>
            ) : (
              <ul className="m-0 list-none space-y-1.5 p-0">
                {lines.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--hos-ink)]">{l.label}</span>
                      <span className="ml-1.5 tabular-nums text-[var(--hos-ink-3)]">
                        {formatNu(l.unitNet)} ea
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Decrease ${l.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hos-line)] text-sm font-bold"
                        onClick={() => bumpQty(l.id, -1)}
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-mono tabular-nums">{l.qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${l.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hos-line)] text-sm font-bold"
                        onClick={() => bumpQty(l.id, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-1 text-[11px] font-semibold text-[var(--hos-ruby)]"
                        onClick={() =>
                          setLines((prev) => prev.filter((x) => x.id !== l.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="hos-cell rounded-xl p-3 text-xs">
              <div className="flex justify-between">
                <span>Net</span>
                <strong className="tabular-nums">{formatNu(previewNet)}</strong>
              </div>
              <div className="flex justify-between text-[var(--hos-ink-3)]">
                <span>All-in</span>
                <strong className="tabular-nums text-[var(--hos-primary)]">
                  {formatNu(previewTax.totalAmount)}
                </strong>
              </div>
            </div>

            <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
              <Button
                className="w-full !min-h-11"
                onClick={() => {
                  start(() => {
                    const res = intakeBag({
                      stayId,
                      service,
                      speed,
                      garments: lines.map(({ id, kind, label, qty, unitNet }) => ({
                        id,
                        kind,
                        label,
                        qty,
                        unitNet,
                      })),
                    });
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success(`${res.bag.bagNo} intake`, {
                        description: laundryBagDescription(res.bag),
                      });
                      setLines(emptyDraftLines());
                    }
                  });
                }}
              >
                Create laundry bag
              </Button>
            </motion.div>
          </GlassPanel>

          <GlassPanel className="p-3.5">
            <strong className="text-sm text-[var(--hos-ink)]">Bag board</strong>
            {bags.length === 0 ? (
              <EmptyState
                title="No laundry bags"
                description="Intake a bag for an in-house guest to begin."
              />
            ) : (
              <>
                <ul className="mt-3 m-0 grid list-none gap-2 p-0 md:hidden">
                  {bags.map((b) => (
                    <li
                      key={b.id}
                      className="hos-cell flex flex-col gap-2 rounded-xl border border-[var(--hos-line)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[12px] font-bold text-[var(--hos-primary)]">
                            {b.bagNo}
                          </div>
                          <button
                            type="button"
                            className="mt-0.5 text-left text-[13px] font-semibold text-[var(--hos-ink)] underline"
                            onClick={() => openStay(b.stayId)}
                          >
                            Rm {b.roomNumber} · {b.guestName}
                          </button>
                        </div>
                        <Badge
                          tone={
                            b.status === "posted"
                              ? "success"
                              : b.status === "ready"
                                ? "teal"
                                : "default"
                          }
                        >
                          {b.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-[var(--hos-ink-3)]">
                        {laundryBagDescription(b)} · {formatNu(b.netAmount)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {b.status !== "posted" && b.status !== "delivered" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!min-h-9"
                            onClick={() => {
                              const res = advanceBag(b.id);
                              if (!res.ok) toast.error(res.error);
                              else toast.message("Bag advanced");
                            }}
                          >
                            Advance
                          </Button>
                        ) : null}
                        {(b.status === "ready" || b.status === "delivered") && (
                          <Button
                            size="sm"
                            className="!min-h-9"
                            onClick={() => {
                              void postBagToFolio(b.id).then((res) => {
                                if (!res.ok) toast.error(res.error);
                                else {
                                  toast.success("Posted to StayHub folio");
                                  openStay(b.stayId);
                                }
                              });
                            }}
                          >
                            Post folio
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 hidden overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] md:block">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                        <th className="px-3 py-2">Bag</th>
                        <th className="px-3 py-2">Guest</th>
                        <th className="px-3 py-2">Items</th>
                        <th className="px-3 py-2">Due</th>
                        <th className="px-3 py-2 text-right">Net</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hos-line)]">
                      {bags.map((b) => (
                        <tr key={b.id}>
                          <td className="px-3 py-2 font-mono font-bold text-[var(--hos-primary)]">
                            {b.bagNo}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-semibold text-[var(--hos-ink)] underline"
                              onClick={() => openStay(b.stayId)}
                            >
                              Rm {b.roomNumber}
                            </button>
                            <div className="text-[10px] text-[var(--hos-ink-3)]">
                              {b.guestName}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {SERVICE_LABEL[b.service]}
                            <div className="max-w-[220px] truncate text-[10px] capitalize text-[var(--hos-ink-3)]">
                              {b.speed} ·{" "}
                              {b.garments.map((g) => `${g.label}×${g.qty}`).join(", ")}
                            </div>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-[11px]">
                            {new Date(b.dueAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {formatNu(b.netAmount)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              tone={
                                b.status === "posted"
                                  ? "success"
                                  : b.status === "ready"
                                    ? "teal"
                                    : "default"
                              }
                            >
                              {b.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {b.status !== "posted" && b.status !== "delivered" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    const res = advanceBag(b.id);
                                    if (!res.ok) toast.error(res.error);
                                    else toast.message("Bag advanced");
                                  }}
                                >
                                  Advance
                                </Button>
                              ) : null}
                              {(b.status === "ready" || b.status === "delivered") && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    void postBagToFolio(b.id).then((res) => {
                                      if (!res.ok) toast.error(res.error);
                                      else {
                                        toast.success("Posted to StayHub folio");
                                        openStay(b.stayId);
                                      }
                                    });
                                  }}
                                >
                                  Post folio
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </GlassPanel>
        </div>
      </div>
    </ModuleFrame>
  );
}
