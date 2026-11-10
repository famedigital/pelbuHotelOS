import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { formatNu, useFrontOfficeStore } from "../lib/front-office-store";
import { useExtrasStore, type ServiceJob } from "../lib/extras-store";

const KINDS: { id: ServiceJob["kind"]; label: string; defaultNet: number }[] = [
  { id: "airport", label: "PBH Airport transfer", defaultNet: 3500 },
  { id: "hotspring", label: "Hot stone bath / spa", defaultNet: 4500 },
  { id: "hike", label: "Tiger's Nest guided hike", defaultNet: 5500 },
  { id: "bike", label: "Mountain bike hire", defaultNet: 1500 },
];

export function ServicesPage() {
  const reduce = useReducedMotion();
  const services = useExtrasStore((s) => s.services);
  const bookService = useExtrasStore((s) => s.bookService);
  const advanceService = useExtrasStore((s) => s.advanceService);
  const postCharge = useFrontOfficeStore((s) => s.postCharge);
  const stays = useFrontOfficeStore((s) => s.stays);
  const inHouse = stays.filter((s) => s.status === "checked_in");
  const [kind, setKind] = useState<ServiceJob["kind"]>("airport");
  const [stayId, setStayId] = useState(inHouse[0]?.id ?? "");
  const [detail, setDetail] = useState("PBH arrival · SUV meet");
  const [when, setWhen] = useState(new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 16));

  return (
    <ModuleFrame
      title="Guest Services"
      description="Spa · transfers · activities"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "booked", label: "Booked", swatch: "var(--hos-primary)" },
            { id: "run", label: "In progress", swatch: "var(--hos-brass)" },
            { id: "done", label: "Done", swatch: "var(--hos-emerald)" },
          ]}
        />
      }
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">Guest Services</h1>
          <Badge tone="default" className="border border-[var(--hos-primary)]">PBH · Spa · Hike</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Airport dispatch · hot stone bath · Tiger's Nest · bike hire equipment log
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KINDS.map((k) => (
          <KpiCard key={k.id} label={k.label} value={services.filter((s) => s.kind === k.id).length} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <GlassPanel className="flex flex-col gap-2 p-3.5">
          <strong className="text-sm">Book service</strong>
          <select value={kind} onChange={(e) => setKind(e.target.value as ServiceJob["kind"])} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs">
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <select value={stayId} onChange={(e) => setStayId(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs">
            <option value="">Walk-in / external</option>
            {inHouse.map((s) => <option key={s.id} value={s.id}>Rm {s.roomNumber} · {s.guestName}</option>)}
          </select>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs" />
          <input value={detail} onChange={(e) => setDetail(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs" />
          <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
            <Button onClick={() => {
              const stay = inHouse.find((s) => s.id === stayId);
              const meta = KINDS.find((k) => k.id === kind)!;
              const job = bookService({
                kind,
                guest: stay?.guestName ?? "Walk-in",
                room: stay?.roomNumber ?? null,
                when: new Date(when).toISOString(),
                detail,
                netAmount: meta.defaultNet,
              });
              void (async () => {
                if (stay) {
                  const posted = await postCharge(
                    stay.id,
                    `${meta.label} · ${detail}`,
                    meta.defaultNet,
                    "fb",
                    "Services Desk",
                  );
                  if (!posted.ok) {
                    toast.error(posted.error);
                    return;
                  }
                }
                toast.success("Service booked", {
                  description: `${job.kind} · ${formatNu(job.netAmount)}`,
                });
              })();
            }}>Book & post folio</Button>
          </motion.div>
        </GlassPanel>

        <GlassPanel className="p-3.5">
          <strong className="text-sm">Dispatch board</strong>
          <ul className="mt-2 m-0 list-none space-y-2 p-0">
            {services.map((s) => (
              <li key={s.id} className="hos-cell flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs">
                <div>
                  <div className="font-semibold capitalize text-[var(--hos-ink)]">{s.kind} · {s.guest}</div>
                  <div className="text-[10px] text-[var(--hos-ink-3)]">{s.detail} · {new Date(s.when).toLocaleString()} · Rm {s.room ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={s.status === "done" ? "success" : s.status === "dispatched" ? "teal" : "default"}>{s.status}</Badge>
                  {s.status !== "done" ? (
                    <Button size="sm" variant="secondary" onClick={() => { advanceService(s.id); toast.message("Status advanced"); }}>Advance</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
