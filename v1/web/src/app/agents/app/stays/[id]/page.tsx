import { HoldCountdown } from "@/components/erp/HoldCountdown";
import { AgentPaymentProofUpload } from "@/components/erp/agent-portal/AgentPaymentProofUpload";
import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
  AgentStatusPill,
  bookingStatusTone,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { Button } from "@/components/ui/button";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentStayDetail } from "@/lib/agent-portal-stays";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Stay ${id.slice(0, 8)} · Partner`,
    robots: { index: false, follow: false },
  };
}

export default async function AgentStayDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();

  const stay = await loadAgentStayDetail(admin, {
    agentId: session.agentId,
    propertyId: session.activePropertyId,
    bookingId: id,
    sessionAgentId: session.agentId,
  });
  if (!stay) notFound();

  const invoices = stay.invoices.filter((i) => i.docKind === "invoice");
  const receipts = stay.invoices.filter((i) => i.docKind === "receipt");

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Stay detail"
        title={stay.confirmationLabel}
        blurb={`${stay.checkIn} → ${stay.checkOut} · ${stay.nights} night${stay.nights === 1 ? "" : "s"} · ${stay.rooms} room${stay.rooms === 1 ? "" : "s"}`}
        actions={
          <>
            <AgentPrimaryLink href={`/agents/app/stays/${stay.id}/voucher`}>
              <span className="inline-flex items-center gap-1.5">
                <PrinterIcon className="size-3.5" />
                Print voucher
              </span>
            </AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/stays">All stays</AgentGhostLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <AgentStatusPill tone={bookingStatusTone(stay.status)}>
          {stay.status.replace(/_/g, " ")}
        </AgentStatusPill>
        {stay.guestName ? (
          <span className="text-sm text-muted-foreground">{stay.guestName}</span>
        ) : null}
        {stay.guideNumber ? (
          <span className="text-sm text-muted-foreground">
            Guide {stay.guideNumber}
          </span>
        ) : null}
        {stay.roomLabel ? (
          <span className="text-sm text-muted-foreground">{stay.roomLabel}</span>
        ) : null}
      </div>

      {stay.status === "held" && stay.holdExpiresAt ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-50/80 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
            Hold timer
          </p>
          <div className="mt-1">
            <HoldCountdown expiresAt={stay.holdExpiresAt} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <AgentMetric
          label="Quoted"
          value={
            stay.quotedBtn == null ? "—" : formatBtn(stay.quotedBtn)
          }
        />
        <AgentMetric label="Paid" value={formatBtn(stay.paidBtn)} tone="ok" />
        <AgentMetric
          label="Due"
          value={formatBtn(stay.dueBtn)}
          tone={Math.abs(stay.dueBtn) > 0.5 ? "warn" : "default"}
        />
      </div>

      <AgentSection title="Invoices & receipts" description="Issued by the hotel desk">
        {stay.invoices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            No tax invoice yet. Desk issues INV after charges are posted.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...invoices, ...receipts].map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-semibold">{doc.docNo}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {doc.docKind} · {doc.status}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="h-9">
                  <Link href={`/agents/app/invoices/${doc.id}`}>
                    View / print
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AgentSection>

      <AgentPaymentProofUpload bookingId={stay.id} />

      <AgentSection title="Uploaded proofs">
        {stay.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {stay.attachments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm"
              >
                <div>
                  <a
                    href={a.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-800 underline-offset-4 hover:underline"
                  >
                    {a.docName ?? "Open file"}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {a.kind.replace(/_/g, " ")} ·{" "}
                    {new Date(a.createdAt).toLocaleString("en-BT")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AgentSection>
    </div>
  );
}
