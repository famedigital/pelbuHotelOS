import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard,
  ModuleFrame,
} from "@hos-v2/ui";
import { useExtrasStore } from "../lib/extras-store";

export function WebsiteNotesPage() {
  const reduce = useReducedMotion();
  const website = useExtrasStore((s) => s.website);
  const updateWebsite = useExtrasStore((s) => s.updateWebsite);

  return (
    <ModuleFrame
      title="Website"
      description="Public booking notes"
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">Website & Booking Engine</h1>
          <Badge tone="default" className="border border-[var(--hos-primary)]">Stay Bhutan</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Direct booking settings · SEO metadata · domain / SSL status
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Domain" value={website.domain.split(".")[0] ?? "—"} delta={website.domain} />
        <KpiCard label="SSL" value={website.sslOk ? "OK" : "Fail"} />
        <KpiCard label="Engine" value={website.bookingEngine ? "Live" : "Off"} />
        <KpiCard label="SEO title" value={website.seoTitle.length} delta="chars" />
      </div>

      <GlassPanel className="flex max-w-2xl flex-col gap-3 p-4">
        <label className="grid gap-1 text-xs font-medium">Booking domain
          <input value={website.domain} onChange={(e) => updateWebsite({ domain: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-medium">SEO title
          <input value={website.seoTitle} onChange={(e) => updateWebsite({ seoTitle: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-medium">SEO description
          <textarea value={website.seoDesc} onChange={(e) => updateWebsite({ seoDesc: e.target.value })} rows={3} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={website.bookingEngine} onChange={(e) => updateWebsite({ bookingEngine: e.target.checked })} />
          Direct booking engine enabled (Stay Bhutan exchange sync)
        </label>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={website.sslOk} onChange={(e) => updateWebsite({ sslOk: e.target.checked })} />
          TLS certificate healthy
        </label>
        <div className="hos-cell rounded-xl p-3 text-xs text-[var(--hos-ink-3)]">
          Status: {website.sslOk ? "HTTPS live" : "TLS attention needed"} · Engine {website.bookingEngine ? "accepting /book traffic" : "paused"} · SEO preview uses title + description on marketplace cards.
        </div>
        <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
          <Button onClick={() => toast.success("Website settings saved", { description: `${website.domain} · SEO + engine flags` })}>
            Save website settings
          </Button>
        </motion.div>
      </GlassPanel>
    </div>
    </ModuleFrame>
  );
}
