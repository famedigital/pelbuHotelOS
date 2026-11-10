import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard, ModuleFrame } from "@hos-v2/ui";
import { useExtrasStore } from "../lib/extras-store";

export function ChannelPage() {
  const reduce = useReducedMotion();
  const conns = useExtrasStore((s) => s.channelConns);
  const stopSell = useExtrasStore((s) => s.stopSell);
  const minStay = useExtrasStore((s) => s.minStay);
  const lastForcePush = useExtrasStore((s) => s.lastForcePush);
  const lastChannelPushStatus = useExtrasStore((s) => s.lastChannelPushStatus);
  const lastChannelPushError = useExtrasStore((s) => s.lastChannelPushError);
  const forceChannelPush = useExtrasStore((s) => s.forceChannelPush);
  const setStopSell = useExtrasStore((s) => s.setStopSell);
  const setMinStay = useExtrasStore((s) => s.setMinStay);

  return (
    <ModuleFrame
      title="Channel · Channex ARI"
      description="Room types · rates · stop-sell · min stay · Booking.com / Agoda / MMT / Expedia"
      actions={
        <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
          <Button
            onClick={() => {
              void forceChannelPush().then((res) => {
                if (!res.ok) {
                  toast.error("Channel ingest failed", { description: res.error });
                  return;
                }
                toast.success("Channel booking created", {
                  description: `createReservation · ${res.bookingId.slice(0, 8)}…`,
                });
              });
            }}
          >
            1-Tap Force Push
          </Button>
        </motion.div>
      }
    >
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Connections" value={conns.length} />
        <KpiCard label="Healthy" value={conns.filter((c) => c.status === "connected").length} />
        <KpiCard label="Stop-sell" value={stopSell ? "ON" : "OFF"} delta="Global" />
        <KpiCard
          label="Last push"
          value={lastForcePush ?? "—"}
          delta={
            lastChannelPushStatus === "failed"
              ? lastChannelPushError ?? "failed"
              : lastChannelPushStatus
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <GlassPanel className="p-3.5">
          <strong className="text-sm">Live OTA connections</strong>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {conns.map((c) => (
              <motion.div key={c.id} className="hos-cell rounded-2xl p-3">
                <div className="flex items-start justify-between">
                  <strong className="text-sm text-[var(--hos-ink)]">{c.name}</strong>
                  <Badge tone={c.status === "connected" ? "success" : c.status === "degraded" ? "vip" : "danger"}>{c.status}</Badge>
                </div>
                <div className="mt-2 text-[11px] text-[var(--hos-ink-3)]">
                  Rooms mapped {c.roomsMapped} · last push {c.lastPush}
                </div>
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-primary)]">
                  ARI: rooms · rates · restrictions
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <strong className="text-sm">Restrictions engine</strong>
          <label className="flex items-center justify-between text-xs font-medium">
            Global stop-sell
            <input type="checkbox" checked={stopSell} onChange={(e) => setStopSell(e.target.checked)} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Minimum stay (nights)
            <input type="number" min={1} value={minStay} onChange={(e) => setMinStay(Number(e.target.value) || 1)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void forceChannelPush().then((res) => {
                if (!res.ok) toast.error(res.error);
                else toast.success("Channel booking ingested");
              });
            }}
          >
            Push restrictions
          </Button>
          <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
            Channex maps Demo Hotel room types DLX/VAL/EXE to each OTA rate plan. Force push clears degraded links.
          </p>
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
