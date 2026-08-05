"use client";

import { setPropertyLogoNavLayout } from "@/app/actions/erp-settings";
import { BrandLockup } from "@/components/site/BrandLockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveLogoSrc } from "@/lib/logo-src";
import {
  DEFAULT_LOGO_NAV_GAP_REM,
  DEFAULT_LOGO_NAV_OFFSET_PCT,
  DEFAULT_LOGO_NAV_SIZE_REM,
} from "@/lib/property-settings";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

const EMPTY = { ok: false as const };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save size & position"}
    </Button>
  );
}

/**
 * Desk controls for public-site header logo size, hang, and mark–title gap.
 */
export function LogoNavLayoutForm({
  propertyId,
  logoPublicId,
  sizeRem = DEFAULT_LOGO_NAV_SIZE_REM,
  offsetPct = DEFAULT_LOGO_NAV_OFFSET_PCT,
  gapRem = DEFAULT_LOGO_NAV_GAP_REM,
}: {
  propertyId: string;
  logoPublicId: string | null;
  sizeRem?: number;
  offsetPct?: number;
  gapRem?: number;
}) {
  const [size, setSize] = useState(sizeRem);
  const [offset, setOffset] = useState(offsetPct);
  const [gap, setGap] = useState(gapRem);
  const [state, formAction] = useActionState(setPropertyLogoNavLayout, EMPTY);

  const logoSrc = useMemo(
    () => resolveLogoSrc(logoPublicId),
    [logoPublicId],
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Controls the guest website header mark. Size is the desktop height/width
        in rem; offset is how far the mark hangs under the glass bar; gap is
        space between the logo and the hotel name.
      </p>

      <div className="relative overflow-hidden rounded-xl border border-border bg-sky-100/50">
        <div className="relative flex h-12 items-center border-b border-border/60 bg-white/80 px-4 md:h-[3.25rem]">
          <BrandLockup
            logoSrc={logoSrc}
            sizeRem={size}
            offsetPct={offset}
            gapRem={gap}
            tone="solid"
          />
          <span className="ml-auto text-xs text-muted-foreground">Preview</span>
        </div>
        <div className="h-16 bg-gradient-to-b from-sky-50 to-transparent" />
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="logo_nav_size_rem" value={size} />
        <input type="hidden" name="logo_nav_offset_pct" value={offset} />
        <input type="hidden" name="logo_nav_gap_rem" value={gap} />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="logo_size_slider">Logo size</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {size.toFixed(1)} rem
            </span>
          </div>
          <input
            id="logo_size_slider"
            type="range"
            min={4}
            max={12}
            step={0.25}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-sky-700"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Smaller</span>
            <span>Larger</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="logo_offset_slider">Offset from nav bar</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {offset.toFixed(0)}% hang
            </span>
          </div>
          <input
            id="logo_offset_slider"
            type="range"
            min={20}
            max={70}
            step={1}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className="w-full accent-sky-700"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Higher on bar</span>
            <span>Hangs lower</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="logo_gap_slider">Gap to hotel name</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {gap.toFixed(2)} rem
            </span>
          </div>
          <input
            id="logo_gap_slider"
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="w-full accent-sky-700"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Tighter</span>
            <span>Wider space</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="logo_nav_size_rem_num">Size (rem)</Label>
            <Input
              id="logo_nav_size_rem_num"
              type="number"
              min={4}
              max={12}
              step={0.25}
              value={size}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setSize(n);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logo_nav_offset_pct_num">Offset (%)</Label>
            <Input
              id="logo_nav_offset_pct_num"
              type="number"
              min={20}
              max={70}
              step={1}
              value={offset}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setOffset(n);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logo_nav_gap_rem_num">Gap (rem)</Label>
            <Input
              id="logo_nav_gap_rem_num"
              type="number"
              min={0}
              max={3}
              step={0.05}
              value={gap}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setGap(n);
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSize(DEFAULT_LOGO_NAV_SIZE_REM);
              setOffset(DEFAULT_LOGO_NAV_OFFSET_PCT);
              setGap(DEFAULT_LOGO_NAV_GAP_REM);
            }}
          >
            Reset defaults
          </Button>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.message ? (
            <p className="text-sm text-emerald-700">{state.message}</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
