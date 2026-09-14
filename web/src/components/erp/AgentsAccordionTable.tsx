"use client";

import type { AgentDocumentRow } from "@/app/actions/erp-agents";
import { AgentDetailPanel } from "@/components/erp/AgentDetailPanel";
import {
  agentPlaceLabel,
  type DeskAgentRow,
} from "@/components/erp/AgentDeskCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export type AgentAccordionRow = DeskAgentRow & {
  documents: AgentDocumentRow[];
};

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : status === "rejected"
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : status === "demo"
          ? "border-accent/30 bg-accent/10 text-accent"
          : status === "directory"
            ? "border-border bg-muted/80 text-foreground/80"
            : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase whitespace-nowrap ${tone}`}
    >
      {status}
    </span>
  );
}

function RowSummary({ row }: { row: AgentAccordionRow }) {
  const available = Math.max(0, row.credit_limit - row.credit_used);
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1 sm:max-w-[14rem]">
        <p className="font-medium text-foreground">{row.company_name}</p>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {agentPlaceLabel(row)}
        </p>
      </div>
      <div className="hidden shrink-0 text-sm sm:block sm:w-[10rem]">
        <span className="text-foreground">
          {[row.contact_name, row.contact_phone].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>
      <div className="hidden shrink-0 text-sm tabular-nums md:block md:w-[8rem]">
        <span className="text-foreground">{formatBtn(row.credit_used)}</span>
        <span className="text-muted-foreground"> / {formatBtn(row.credit_limit)}</span>
      </div>
      <div className="hidden shrink-0 text-xs text-muted-foreground lg:block lg:w-[6rem]">
        {row.rate_tier}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:justify-end">
        <StatusPill status={row.status} />
        {row.wants_mou ? (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            MoU
          </span>
        ) : null}
        <span className="hidden text-xs tabular-nums text-muted-foreground xl:inline">
          Avail {formatBtn(available)}
        </span>
      </div>
      <Link
        href={`/erp/agents/${row.id}`}
        className="hidden shrink-0 items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted xl:inline-flex"
        onClick={(e) => e.stopPropagation()}
      >
        Open dossier →
      </Link>
    </div>
  );
}

function MobileRowSummary({ row }: { row: AgentAccordionRow }) {
  const available = Math.max(0, row.credit_limit - row.credit_used);
  return (
    <div className="flex w-full flex-col gap-2 pr-2 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{row.company_name}</p>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {agentPlaceLabel(row)}
          </p>
        </div>
        <StatusPill status={row.status} />
      </div>
      <p className="text-sm text-foreground">
        {[row.contact_name, row.contact_phone].filter(Boolean).join(" · ") || "No contact"}
      </p>
      <p className="text-sm tabular-nums text-muted-foreground">
        Credit {formatBtn(row.credit_used)} / {formatBtn(row.credit_limit)} · Avail{" "}
        {formatBtn(available)} · {row.rate_tier}
      </p>
      {row.wants_mou ? (
        <span className="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          MoU
        </span>
      ) : null}
    </div>
  );
}

export function AgentsAccordionTable({
  data,
  emptyMessage = "No agents match.",
  filter = "trade",
}: {
  data: AgentAccordionRow[];
  emptyMessage?: string;
  /** trade = non-directory default desk view; directory = TCB listings only; all = no filter */
  filter?: "trade" | "directory" | "pending" | "all";
}) {
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("id");

  const filtered = (() => {
    if (filter === "all") return data;
    if (filter === "directory") {
      return data.filter((r) => r.status === "directory");
    }
    if (filter === "pending") {
      return data.filter((r) => r.status === "pending");
    }
    // trade partners: applications + approved/demo — not mass directory
    return data.filter((r) => r.status !== "directory");
  })();

  const matchedDeepLink =
    deepLinkId &&
    filtered.some((r) => r.id === deepLinkId || r.id.startsWith(deepLinkId))
      ? filtered.find(
          (r) => r.id === deepLinkId || r.id.startsWith(deepLinkId),
        )?.id
      : undefined;

  const [openId, setOpenId] = useState<string | undefined>(matchedDeepLink);

  useEffect(() => {
    if (matchedDeepLink) setOpenId(matchedDeepLink);
  }, [matchedDeepLink]);

  if (filtered.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={openId}
      onValueChange={setOpenId}
      className="rounded-xl border border-border bg-card"
    >
      <div
        className="hidden border-b bg-muted/30 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-[1fr_10rem_8rem_6rem_auto] sm:gap-4 md:grid-cols-[14rem_10rem_8rem_6rem_1fr_auto]"
        aria-hidden
      >
        <span>Agent</span>
        <span className="hidden sm:inline">Contact</span>
        <span className="hidden md:inline">Credit</span>
        <span className="hidden lg:inline">Tier</span>
        <span className="hidden sm:inline sm:col-span-1 md:col-span-1">Status</span>
        <span className="hidden xl:inline">Action</span>
      </div>

      {filtered.map((row) => (
        <AccordionItem
          key={row.id}
          value={row.id}
          className="border-b border-border/70 px-3 last:border-b-0 sm:px-4"
        >
          <AccordionTrigger className="py-3 hover:no-underline sm:py-3.5">
            <span className="hidden w-full sm:block">
              <RowSummary row={row} />
            </span>
            <span className="w-full sm:hidden">
              <MobileRowSummary row={row} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/50 bg-muted/10 px-1 pb-4 pt-3 sm:px-2">
            {openId === row.id ? (
              <AgentDetailPanel agent={row} documents={row.documents} compact />
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
