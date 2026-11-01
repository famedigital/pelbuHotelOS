"use client";

import {
  StayHubHeader,
  type StayHubIdentityProps,
} from "@/components/erp/stay-hub/StayHubChrome";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * StayHub 3D glass header — identity + Himalayan status badges + live balance.
 */
export function StayHubHeaderBar({
  identity,
  balanceBtn = null,
  vip = false,
  className,
}: {
  identity: StayHubIdentityProps;
  balanceBtn?: number | null;
  vip?: boolean;
  className?: string;
}) {
  const clear =
    balanceBtn == null || !Number.isFinite(balanceBtn) || Math.abs(balanceBtn) <= 0.5;
  const inHouse = (identity.status ?? "").toLowerCase() === "checked_in";

  return (
    <div className={cn("relative border-b border-border/40", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(245,158,11,0.08),transparent_55%)]" />
      <div className="relative flex flex-wrap items-center gap-2 px-3 pt-2 md:px-4">
        {inHouse ? (
          <span className="inline-flex items-center rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-200">
            In-house
          </span>
        ) : null}
        {vip || identity.agentName ? (
          <span className="glass-badge-vip inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            {vip ? "VIP" : "Agent"}
          </span>
        ) : null}
        {balanceBtn != null ? (
          <span
            className={cn(
              "ml-auto text-sm font-semibold tabular-nums",
              !clear && "text-maroon",
            )}
          >
            Balance: {clear ? "BTN 0.00" : formatGuestBtn(balanceBtn)}
          </span>
        ) : null}
      </div>
      <StayHubHeader {...identity} dueChipBtn={null} />
    </div>
  );
}
