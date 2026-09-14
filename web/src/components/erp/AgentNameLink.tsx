"use client";

import { agentDossierHref } from "@/lib/erp/agent-links";
import type { AgentDossierTab } from "@/lib/reports/agent-dossier";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

type Props = {
  agentId: string | null | undefined;
  name: string | null | undefined;
  /** Fallback when no agent_id (plain text). */
  className?: string;
  tab?: AgentDossierTab;
  from?: string;
  to?: string;
  title?: string;
  /** Prevent parent row/chip opening Stay hub etc. */
  stopPropagation?: boolean;
  children?: ReactNode;
};

/**
 * Shared agent identity link — opens the agent dossier (bookings, rooms,
 * money, credit) used from calendar, Stay hub, and booking boards.
 */
export function AgentNameLink({
  agentId,
  name,
  className,
  tab = "overview",
  from,
  to,
  title,
  stopPropagation = true,
  children,
}: Props) {
  const label = (name ?? "").trim() || "Agent";
  if (!agentId) {
    return (
      <span className={cn("min-w-0 truncate", className)} title={title ?? label}>
        {children ?? label}
      </span>
    );
  }

  return (
    <Link
      href={agentDossierHref(agentId, { tab, from, to })}
      className={cn(
        "min-w-0 truncate font-medium text-accent underline-offset-2 hover:underline",
        className,
      )}
      title={title ?? `Open agent · ${label}`}
      onClick={(e: MouseEvent) => {
        if (stopPropagation) e.stopPropagation();
      }}
    >
      {children ?? label}
    </Link>
  );
}
