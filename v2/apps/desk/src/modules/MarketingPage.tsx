import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard, MorphTabs,
  ModuleFrame,
  StatusLegend,
} from "@hos-v2/ui";
import { useExtrasStore } from "../lib/extras-store";
import { SocialClipsStudio } from "./marketing/SocialClipsStudio";

type MainTab = "campaigns" | "clips";

const TABS: { id: MainTab; label: string }[] = [
  { id: "campaigns", label: "Campaigns" },
  { id: "clips", label: "Social Clips" },
];

export function MarketingPage() {
  const reduce = useReducedMotion();
  const campaigns = useExtrasStore((s) => s.campaigns);
  const waTemplate = useExtrasStore((s) => s.waTemplate);
  const emailTemplate = useExtrasStore((s) => s.emailTemplate);
  const toggleCampaign = useExtrasStore((s) => s.toggleCampaign);
  const addCampaign = useExtrasStore((s) => s.addCampaign);
  const updateTemplates = useExtrasStore((s) => s.updateTemplates);
  const [tab, setTab] = useState<MainTab>("campaigns");
  const [wa, setWa] = useState(waTemplate);
  const [email, setEmail] = useState(emailTemplate);
  const [name, setName] = useState("Winter Lean Offer");
  const [code, setCode] = useState("LEAN12");
  const [pct, setPct] = useState(12);

  return (
    <ModuleFrame
      title="Marketing"
      description="Campaigns · offers"
      actions={
        <StatusLegend
          dense
          items={[
            { id: "on", label: "Live", swatch: "var(--hos-emerald)" },
            { id: "off", label: "Paused", swatch: "var(--hos-ink-3)" },
            { id: "clip", label: "Clips", swatch: "var(--hos-primary)" },
          ]}
        />
      }
    >
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">Marketing</h1>
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            Campaigns · Clips
          </Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Promo codes · WhatsApp templates · on-device Social Clips (WASM)
        </p>
      </div>

      <MorphTabs
        glowId="marketingMainGlow"
        value={tab}
        onChange={setTab}
        items={TABS}
      />

      {tab === "campaigns" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label="Campaigns" value={campaigns.length} />
            <KpiCard
              label="Active"
              value={campaigns.filter((c) => c.active).length}
            />
            <KpiCard
              label="Avg discount"
              value={`${Math.round(campaigns.reduce((s, c) => s + c.discountPct, 0) / Math.max(1, campaigns.length))}%`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-3.5">
              <strong className="text-sm">Promo campaigns</strong>
              <ul className="mt-2 m-0 list-none space-y-2 p-0">
                {campaigns.map((c) => (
                  <li
                    key={c.id}
                    className="hos-cell flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="font-mono text-[var(--hos-primary)]">
                        {c.code} · {c.discountPct}%
                      </div>
                      <div className="text-[10px] text-[var(--hos-ink-3)]">
                        {c.starts} → {c.ends}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={c.active ? "secondary" : "primary"}
                      onClick={() => {
                        toggleCampaign(c.id);
                        toast.message(c.active ? "Paused" : "Activated");
                      }}
                    >
                      {c.active ? "Active" : "Off"}
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid gap-2 border-t border-[var(--hos-line)] pt-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="number"
                    value={pct}
                    onChange={(e) => setPct(Number(e.target.value) || 0)}
                    className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    addCampaign({
                      name,
                      code,
                      discountPct: pct,
                      active: true,
                      starts: "2026-12-01",
                      ends: "2027-02-28",
                    });
                    toast.success("Campaign created");
                  }}
                >
                  Add campaign
                </Button>
              </div>
            </GlassPanel>

            <GlassPanel className="flex flex-col gap-2 p-3.5">
              <strong className="text-sm">Arrival templates</strong>
              <label className="grid gap-1 text-xs font-medium">
                WhatsApp
                <textarea
                  value={wa}
                  onChange={(e) => setWa(e.target.value)}
                  rows={4}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-[11px]"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Email
                <textarea
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  rows={6}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-[11px]"
                />
              </label>
              <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
                <Button
                  onClick={() => {
                    updateTemplates(wa, email);
                    toast.success("Templates saved");
                  }}
                >
                  Save templates
                </Button>
              </motion.div>
            </GlassPanel>
          </div>
        </>
      ) : (
        <SocialClipsStudio />
      )}
    </div>
    </ModuleFrame>
  );
}
