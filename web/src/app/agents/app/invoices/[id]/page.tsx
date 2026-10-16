import { PrintButton } from "@/components/erp/PrintButton";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import { formatBtn, formatGuestBtn, roundBtn } from "@/lib/pricing";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Invoice · Partner",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/**
 * Agent-scoped fiscal document view — only when the folio belongs to their stay.
 */
export default async function AgentInvoicePage({ params }: Props) {
  const { id } = await params;
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();

  const { data: doc } = await admin
    .from("fiscal_documents")
    .select(
      "id, doc_no, doc_kind, status, issued_at, property_id, folio_id, total_btn",
    )
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.property_id !== session.activePropertyId) notFound();

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, booking_id, agent_id, label, bookings(id, agent_id, confirmation_code, contact_name, check_in, check_out), folio_lines(id, description, total_btn, gst_btn, status, source_type, reverses_line_id)",
    )
    .eq("id", doc.folio_id)
    .maybeSingle();
  if (!folio) notFound();

  const bookingRaw = folio.bookings;
  const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;
  const ownerAgent =
    (folio.agent_id as string | null) ??
    (booking?.agent_id as string | null) ??
    null;
  if (ownerAgent !== session.agentId) notFound();

  const lines = guestVisibleBalanceLines(
    ((folio.folio_lines ?? []) as Array<{
      id: string;
      description: string;
      total_btn: number;
      gst_btn: number;
      status: string;
      source_type: string;
      reverses_line_id?: string | null;
    }>).map((l) => ({
      id: l.id,
      description: l.description,
      total_btn: Number(l.total_btn ?? 0),
      gst_btn: Number(l.gst_btn ?? 0),
      status: l.status,
      source_type: l.source_type,
      reverses_line_id: l.reverses_line_id ?? null,
    })),
  );

  const property = await loadProperty(admin, session.activePropertyId);
  const subtotal = lines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl bg-white px-6 py-8 text-neutral-900 print:px-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={
            booking?.id
              ? `/agents/app/stays/${booking.id}`
              : "/agents/app/stays"
          }
          className="text-sm text-sky-800 underline-offset-4 hover:underline"
        >
          ← Back
        </Link>
        <PrintButton label="Print" />
      </div>

      <header className="border-b pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-800 uppercase">
          {doc.doc_kind === "receipt" ? "Receipt" : "Tax invoice"}
        </p>
        <h1 className="mt-1 font-mono text-2xl font-semibold">{doc.doc_no}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {property?.name ?? "Hotel"} · {session.companyName}
        </p>
        <p className="text-xs text-neutral-500">
          Status {doc.status}
          {doc.issued_at
            ? ` · issued ${new Date(doc.issued_at as string).toLocaleDateString("en-BT")}`
            : ""}
        </p>
      </header>

      {booking ? (
        <p className="mt-4 text-sm text-neutral-700">
          Stay {booking.check_in} → {booking.check_out}
          {booking.contact_name ? ` · ${booking.contact_name}` : ""}
          {booking.confirmation_code
            ? ` · ${booking.confirmation_code}`
            : ""}
        </p>
      ) : null}

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-4 text-neutral-500">
                No guest-visible lines.
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.id} className="border-b border-neutral-100">
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatGuestBtn(Number(l.total_btn ?? 0))}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold">Total</td>
            <td className="pt-3 text-right font-semibold tabular-nums">
              {doc.total_btn != null
                ? formatBtn(Number(doc.total_btn))
                : formatBtn(roundBtn(subtotal))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
