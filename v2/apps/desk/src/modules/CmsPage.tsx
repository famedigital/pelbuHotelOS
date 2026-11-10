import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { useExtrasStore } from "../lib/extras-store";

export function CmsPage() {
  const reduce = useReducedMotion();
  const cms = useExtrasStore((s) => s.cms);
  const updateCms = useExtrasStore((s) => s.updateCms);

  return (
    <ModuleFrame
      title="CMS"
      description="Hero · story · restaurant hours"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "hero", label: "Hero", swatch: "var(--hos-primary)" },
            { id: "story", label: "Story", swatch: "var(--hos-brass)" },
            { id: "hrs", label: "Hours", swatch: "var(--hos-emerald)" },
          ]}
        />
      }
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">CMS</h1>
          <Badge tone="default" className="border border-[var(--hos-primary)]">Content</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Hero copy · property story · restaurant hours & menu notes · room photo slots
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Hero title chars" value={cms.heroTitle.length} />
        <KpiCard label="Story chars" value={cms.story.length} />
        <KpiCard label="Photo slots" value={8} delta="Room gallery" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="flex flex-col gap-2 p-4">
          <strong className="text-sm">Public hero</strong>
          <label className="grid gap-1 text-xs font-medium">Title
            <input value={cms.heroTitle} onChange={(e) => updateCms({ heroTitle: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-xs font-medium">Subtitle
            <input value={cms.heroSub} onChange={(e) => updateCms({ heroSub: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-xs font-medium">Property story
            <textarea value={cms.story} onChange={(e) => updateCms({ story: e.target.value })} rows={4} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
          </label>
        </GlassPanel>
        <GlassPanel className="flex flex-col gap-2 p-4">
          <strong className="text-sm">Restaurant & hours</strong>
          <label className="grid gap-1 text-xs font-medium">Operating hours
            <input value={cms.restaurantHours} onChange={(e) => updateCms({ restaurantHours: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-xs font-medium">Menu note
            <textarea value={cms.menuNote} onChange={(e) => updateCms({ menuNote: e.target.value })} rows={3} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2" />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {["Deluxe King", "Valley View", "Executive", "Lobby"].map((label) => (
              <div key={label} className="hos-cell aspect-square flex items-center justify-center rounded-xl p-2 text-center text-[10px] font-semibold text-[var(--hos-ink-3)]">
                {label} photo
              </div>
            ))}
          </div>
          <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
            <Button onClick={() => toast.success("CMS published", { description: "Public site + booking hero updated" })}>Publish content</Button>
          </motion.div>
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
