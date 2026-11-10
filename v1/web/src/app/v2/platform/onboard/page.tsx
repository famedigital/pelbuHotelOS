"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Sprout, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import { superadminFetchJson } from "@/lib/v2/superadmin-api-client";

type OnboardResult = {
  ok?: boolean;
  property?: { id: string; name: string; slug: string };
  next?: string;
  ownerEmail?: string | null;
  error?: string;
};

/**
 * POST /v1/onboard/property — `requirePlatformAdmin`: the signed-in staff JWT must
 * be listed in `platform_admins` (same as other superadmin routes).
 */
export default function V2PlatformOnboardPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Asia/Thimphu");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (name.trim().length < 2 || slug.trim().length < 2) {
      toast.error("Name and slug are required (slug: lowercase letters, numbers, hyphen).");
      return;
    }
    start(async () => {
      try {
        setResult(null);
        const body: Record<string, unknown> = {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          timezone: timezone.trim() || "Asia/Thimphu",
        };
        if (ownerEmail.trim()) {
          body.ownerEmail = ownerEmail.trim();
        }
        const data = await superadminFetchJson<OnboardResult>("/v1/onboard/property", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setResult(data);
        toast.success("Property created");
      } catch (err) {
        console.error("[v2/platform/onboard]", err);
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-56px)] bg-[#030712] text-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center [transform:translateZ(0)]">
              <Sprout className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Onboard property</h1>
              <p className="text-[11px] text-slate-500">POST /v1/onboard/property (platform admin JWT)</p>
            </div>
          </div>
          <Link href="/v2" className="text-xs text-indigo-400 border border-white/10 px-2 py-1 rounded-lg">
            ← hub
          </Link>
        </div>

        <NeoGlassCard className="p-5 glass-card border-white/[0.12] [transform:translateZ(0)] space-y-3">
          <label className="grid gap-1 text-xs text-slate-400">
            Property name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-400">
            Slug (URL)
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-lodge"
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-400">
            Timezone
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-400">
            Owner email (optional, stored in request only — not persisted until registry work)
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </label>
          <TactileButton
            variant="emerald"
            size="md"
            disabled={pending}
            onClick={() => submit()}
            icon={pending ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Create tenant
          </TactileButton>
          <p className="text-[10px] text-slate-500">
            API inserts <code className="text-slate-400">properties</code> and upserts{" "}
            <code className="text-slate-400">saas_tenant_licenses</code> (boutique tier). No public self-serve route.
          </p>
        </NeoGlassCard>

        {result?.property ? (
          <NeoGlassCard className="p-4 glass-card border-emerald-500/25">
            <p className="text-sm text-emerald-300 font-mono">{result.property.name}</p>
            <p className="text-xs text-slate-400">
              id {result.property.id} · slug {result.property.slug}
            </p>
            {result.next ? <p className="text-xs text-slate-500 mt-2">{result.next}</p> : null}
          </NeoGlassCard>
        ) : null}
      </div>
    </div>
  );
}
