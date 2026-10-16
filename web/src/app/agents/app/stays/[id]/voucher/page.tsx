import { PrintButton } from "@/components/erp/PrintButton";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentStayDetail } from "@/lib/agent-portal-stays";
import { formatBtn } from "@/lib/pricing";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Stay voucher",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/** Partner-printable confirmation voucher (not a tax invoice). */
export default async function AgentStayVoucherPage({ params }: Props) {
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

  const property = await loadProperty(admin, session.activePropertyId);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl bg-white px-6 py-8 text-neutral-900 print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/agents/app/stays/${stay.id}`}
          className="text-sm text-sky-800 underline-offset-4 hover:underline"
        >
          ← Stay detail
        </Link>
        <PrintButton label="Print voucher" />
      </div>

      <header className="border-b border-neutral-200 pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-800 uppercase">
          Room confirmation
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {property?.name ?? "Hotel"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Partner voucher for {session.companyName} — not a tax invoice
        </p>
      </header>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Confirmation
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold">
            {stay.confirmationLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Status
          </dt>
          <dd className="mt-1 capitalize">{stay.status.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Guest / party
          </dt>
          <dd className="mt-1">{stay.guestName ?? session.companyName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Guide
          </dt>
          <dd className="mt-1">{stay.guideNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Stay
          </dt>
          <dd className="mt-1 tabular-nums">
            {stay.checkIn} → {stay.checkOut}
            <span className="block text-sm text-neutral-600">
              {stay.nights} night{stay.nights === 1 ? "" : "s"} · {stay.rooms}{" "}
              room{stay.rooms === 1 ? "" : "s"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Room type
          </dt>
          <dd className="mt-1">{stay.roomLabel ?? "As assigned"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Quoted (partner)
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {stay.quotedBtn == null ? "On request" : formatBtn(stay.quotedBtn)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Balance due
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {formatBtn(stay.dueBtn)}
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-xs leading-relaxed text-neutral-500">
        Rates settle on the guest folio / agent AR per commercial terms. Present
        this voucher at check-in with guest ID. Tax invoices (INV-…) are issued
        separately by the hotel.
      </p>
    </div>
  );
}
