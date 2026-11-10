import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, GlassPanel, KpiCard,
  ModuleFrame,
} from "@hos-v2/ui";
import { formatNu, taxBreakdown, useFrontOfficeStore } from "../lib/front-office-store";
import {
  GARMENT_RATES,
  SERVICE_LABEL,
  useOpsStore,
  type GarmentKind,
  type LaundryService,
  type LaundrySpeed,
} from "../lib/ops-store";

const GARMENTS: GarmentKind[] = ["gho", "kira", "suit", "shirt", "dress", "woolen"];

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
  const [qty, setQty] = useState<Record<GarmentKind, number>>({
    gho: 0,
    kira: 0,
    suit: 0,
    shirt: 0,
    dress: 0,
    woolen: 0,
  });

  const previewNet = useMemo(() => {
    const base = GARMENTS.reduce((s, g) => s + GARMENT_RATES[g] * (qty[g] || 0), 0);
    const mult =
      (service === "dry_clean" ? 1.4 : service === "wash_iron" ? 1 : 0.7) *
      (speed === "express" ? 1.5 : 1);
    return Math.round(base * mult);
  }, [qty, service, speed]);
  const previewTax = taxBreakdown(previewNet);

  const openBags = bags.filter((b) => b.status !== "posted").length;
  const express = bags.filter((b) => b.speed === "express" && b.status !== "posted").length;

  return (
    <ModuleFrame
      title="Laundry & Valet"
      description="Bag intake · express · folio post"
    >
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Open bags" value={openBags} delta="In plant" />
        <KpiCard label="Express" value={express} delta="4h SLA" />
        <KpiCard label="Posted today" value={bags.filter((b) => b.status === "posted").length} />
        <KpiCard label="Preview all-in" value={formatNu(previewTax.totalAmount)} delta="SC+BST" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <strong className="text-sm text-[var(--hos-ink)]">Digital bag intake</strong>
          <label className="grid gap-1 text-xs font-medium text-[var(--hos-ink-2)]">
            In-house guest
            <select
              value={stayId}
              onChange={(e) => setStayId(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
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
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
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
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold capitalize ${
                  speed === s
                    ? "border border-[var(--hos-primary)]/40 bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
                    : "border border-[var(--hos-line)]"
                }`}
              >
                {s} {s === "express" ? "(+50%)" : "(24h)"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {GARMENTS.map((g) => (
              <label key={g} className="hos-cell rounded-xl p-2 text-xs capitalize">
                <div className="flex justify-between font-semibold">
                  <span>{g}</span>
                  <span className="tabular-nums text-[var(--hos-ink-3)]">
                    {formatNu(GARMENT_RATES[g])}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={qty[g] || ""}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [g]: Number(e.target.value) || 0 }))
                  }
                  className="mt-1 w-full rounded-md border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1"
                />
              </label>
            ))}
          </div>

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
              className="w-full"
              onClick={() => {
                start(() => {
                  const res = intakeBag({
                    stayId,
                    service,
                    speed,
                    garments: GARMENTS.map((g) => ({ kind: g, qty: qty[g] || 0 })),
                  });
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success(`${res.bag.bagNo} intake`, {
                      description: `${SERVICE_LABEL[service]} · due ${new Date(res.bag.dueAt).toLocaleString()}`,
                    });
                    setQty({
                      gho: 0,
                      kira: 0,
                      suit: 0,
                      shirt: 0,
                      dress: 0,
                      woolen: 0,
                    });
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
            <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-3 py-2">Bag</th>
                    <th className="px-3 py-2">Guest</th>
                    <th className="px-3 py-2">Service</th>
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
                        <div className="text-[10px] text-[var(--hos-ink-3)]">{b.guestName}</div>
                      </td>
                      <td className="px-3 py-2">
                        {SERVICE_LABEL[b.service]}
                        <div className="capitalize text-[10px] text-[var(--hos-ink-3)]">
                          {b.speed}
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
          )}
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
