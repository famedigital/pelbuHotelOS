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
      aria-label="Agent dossier sections"
      className="flex gap-1 overflow-x-auto border-b pb-0"
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
              "inline-flex h-9 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors",
              active
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
