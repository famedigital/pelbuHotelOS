import { AgentSettlementPrintSheet } from "@/components/erp/AgentSettlementPrintSheet";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { PrintButton } from "@/components/erp/PrintButton";
import { Button } from "@/components/ui/button";
import { loadSettlementPrintPack } from "@/app/actions/erp-settlement-pack";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Settlement pack",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function SettlementPackPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id: bookingId } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: booking } = await admin
    .from("bookings")
    .select(
      `id, contact_name, check_in, check_out, rooms, guide_number, status,
       agent_id, guide_sign_status, guide_sign_photo_public_id, property_id,
       agents(company_name, contact_email, contact_name)`,
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!booking) notFound();

  const agentRaw = booking.agents as
    | { company_name?: string; contact_email?: string; contact_name?: string }
    | { company_name?: string; contact_email?: string; contact_name?: string }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

  const { data: pack } = await admin
    .from("booking_settlement_packs")
    .select("*")
    .eq("booking_id", bookingId)
    .order("sealed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const printPack = await loadSettlementPrintPack(admin, bookingId, propertyId);

  const totals = (pack?.totals_json ?? {}) as Record<string, number | string | null>;
  const photoId =
    (pack?.guide_photo_public_id as string | null) ||
    (booking.guide_sign_photo_public_id as string | null);
  const photoUrl = photoId
    ? cloudinaryUrl(photoId, { width: 1400, crop: "limit" })
    : null;

  return (
    <DeskListShell
      title="Settlement pack"
      eyebrow="FO · Agent evidence"
      heading={booking.contact_name ?? "Guest"}
      blurb={`${booking.check_in} → ${booking.check_out} · ${agent?.company_name ?? "—"} · guide ${booking.guide_number ?? "—"}`}
      headerAside={
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton />
          <Button asChild variant="outline" size="sm">
            <Link href={`/erp/bookings/${bookingId}`}>Booking</Link>
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 print:max-w-none">
        {/* Professional pack — primary document when printing this page */}
        <div className="rounded-lg border bg-white shadow-sm print:border-0 print:shadow-none">
          <AgentSettlementPrintSheet pack={printPack} />
        </div>

        <section className="rounded-lg border bg-card p-6 print:hidden">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            Sealed snapshot
          </p>
          {pack ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Sealed {new Date(pack.sealed_at as string).toLocaleString()}
                {pack.email_sent_at
                  ? ` · emailed ${pack.email_to} ${new Date(pack.email_sent_at as string).toLocaleString()}`
                  : " · not emailed yet"}
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Charges</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBtn(Number(totals.chargesBtn ?? printPack.chargesBtn))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Payments</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBtn(
                      Number(totals.paymentsBtn ?? printPack.paymentsBtn),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Balance</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBtn(Number(totals.balanceBtn ?? printPack.balanceBtn))}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
              Not sealed yet — use StayHub Checkout → Seal pack. Amounts above
              are live folio.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6 print:hidden">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            Guide-signed paper
          </p>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            Status: {(booking.guide_sign_status as string) ?? "pending"}
          </p>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Guide signed settlement pack"
              className="mt-4 max-h-[70vh] w-full rounded-md border bg-muted/20 object-contain"
            />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No photo/scan on file.
            </p>
          )}
        </section>
      </div>
    </DeskListShell>
  );
}
