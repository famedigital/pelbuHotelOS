"use client";

import { AGENT_DOSSIER_TABS, type AgentDossierTab } from "@/lib/reports/agent-dossier";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function AgentDossierTabNav({
  agentId,
  tab,
  from,
  to,
}: {
  agentId: string;
  tab: AgentDossierTab;
  from: string;
  to: string;
}) {
  return (
    <nav
      aria-label="Agent account sections"
      className="flex gap-1 overflow-x-auto rounded-lg bg-secondary/70 p-1"
    >
      {AGENT_DOSSIER_TABS.map((t) => {
        const href = `/erp/agents/${agentId}?tab=${t.id}&from=${from}&to=${to}`;
        const active = t.id === tab;
        return (
          <Link
            key={t.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
