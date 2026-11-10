import { motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { formatNu, ymd } from "../lib/front-office-store";
import { useExtrasStore } from "../lib/extras-store";

export function EventsPage() {
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const events = useExtrasStore((s) => s.events);
  const bookEvent = useExtrasStore((s) => s.bookEvent);
  const invoiceEvent = useExtrasStore((s) => s.invoiceEvent);
  const [title, setTitle] = useState("Corporate Offsite");
  const [hall, setHall] = useState<"druk" | "valley">("valley");
  const [date, setDate] = useState(ymd(new Date()));
  const [pax, setPax] = useState(25);
  const [pkg, setPkg] = useState("Morning tea + Conference lunch + AV");

  const net = pax * (pkg.includes("AV") ? 1700 : 1200);

  return (
    <ModuleFrame
      title="Events & Banquets"
      description="Function diary · BEO"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "conf", label: "Confirmed", swatch: "var(--hos-emerald)" },
            { id: "tent", label: "Tentative", swatch: "var(--hos-brass)" },
            { id: "inv", label: "Invoiced", swatch: "var(--hos-primary)" },
          ]}
        />
      }
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">Events & Banquets</h1>
          <Badge tone="default" className="border border-[var(--hos-primary)]">Druk · Valley</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Hall schedule · delegate packages · banquet folio → master INV
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Bookings" value={events.length} />
        <KpiCard label="Confirmed" value={events.filter((e) => e.status === "confirmed").length} />
        <KpiCard label="Invoiced" value={events.filter((e) => e.status === "invoiced").length} />
        <KpiCard label="Pipeline" value={formatNu(events.reduce((s, e) => s + e.netAmount, 0))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <GlassPanel className="flex flex-col gap-2 p-3.5">
          <strong className="text-sm">Package builder</strong>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs" />
          <select value={hall} onChange={(e) => setHall(e.target.value as "druk" | "valley")} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs">
            <option value="druk">Druk Hall (80 pax)</option>
            <option value="valley">Valley Hall (40 pax)</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs" />
          <input type="number" value={pax} onChange={(e) => setPax(Number(e.target.value) || 1)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs" />
          <select value={pkg} onChange={(e) => setPkg(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs">
            <option>Morning tea + Conference lunch</option>
            <option>Morning tea + Conference lunch + AV</option>
            <option>Full day banquet + AV</option>
          </select>
          <div className="text-xs font-semibold">Net estimate {formatNu(net)}</div>
          <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
            <Button onClick={() => {
              const ev = bookEvent({ hall, title, date, pax, package: pkg, netAmount: net });
              toast.success("Event confirmed", { description: `${ev.hall} hall · ${ev.pax} pax` });
            }}>Book hall</Button>
          </motion.div>
        </GlassPanel>

        <GlassPanel className="overflow-x-auto p-3.5">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                <th className="px-2 py-2">Event</th><th className="px-2 py-2">Hall</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Pax</th><th className="px-2 py-2 text-right">Net</th><th className="px-2 py-2">Status</th><th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hos-line)]">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-2 py-2 font-semibold">{e.title}<div className="text-[10px] text-[var(--hos-ink-3)]">{e.package}</div></td>
                  <td className="px-2 py-2 capitalize">{e.hall}</td>
                  <td className="px-2 py-2 tabular-nums">{e.date}</td>
                  <td className="px-2 py-2">{e.pax}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatNu(e.netAmount)}</td>
                  <td className="px-2 py-2"><Badge tone={e.status === "invoiced" ? "success" : "default"}>{e.status}</Badge></td>
                  <td className="px-2 py-2">
                    {e.status !== "invoiced" ? (
                      <Button size="sm" variant="secondary" onClick={() => {
                        start(() => {
                          const res = invoiceEvent(e.id);
                          if (!res.ok) toast.error(res.error);
                          else toast.success("Banquet posted to master INV");
                        });
                      }}>Invoice</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
