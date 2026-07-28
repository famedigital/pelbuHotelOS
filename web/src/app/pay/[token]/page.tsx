import { ConversionShell } from "@/components/site/ConversionShell";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Pay Pelbu Suites",
    robots: { index: false, follow: false },
    description: `Deposit / balance payment · ${token.slice(0, 6)}`,
  };
}

export default async function PublicPayPage({ params }: Props) {
  const { token } = await params;
  if (!token || token.length < 12) notFound();

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("payment_links")
    .select(
      "id, amount_btn, purpose, status, payee_name, bank_hint, expires_at, notes, booking_id",
    )
    .eq("token", token)
    .maybeSingle();

  if (!link) notFound();

  const expired =
    link.expires_at && new Date(link.expires_at as string).getTime() < Date.now();
  const status = link.status as string;
  const purposeLabel =
    (link.purpose as string) === "deposit" ? "Room deposit" : "Balance payment";

  return (
    <ConversionShell
      eyebrow="Pay"
      title={purposeLabel}
      body="Transfer via bank QR, Pay.bt, or bank transfer. Front desk confirms when funds clear and posts to your folio."
    >
      <div className="border border-espresso/10 bg-white px-6 py-8">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-gold uppercase">
          Amount due
        </p>
        <p className="mt-2 text-3xl tabular-nums text-espresso">
          {formatBtn(Number(link.amount_btn))}
        </p>

        {link.payee_name ? (
          <p className="mt-4 text-sm text-espresso">For {link.payee_name as string}</p>
        ) : null}

        <p className="mt-6 text-sm text-muted">
          {(link.bank_hint as string) ??
            "Transfer to Pelbu Suites · BoB / BNB / TBank / DrukPNB"}
        </p>

        {link.booking_id ? (
          <p className="mt-3 font-mono text-xs text-espresso/50">
            Ref {(link.booking_id as string).slice(0, 8)}
          </p>
        ) : null}

        <p className="mt-8 text-xs font-medium uppercase tracking-wide text-espresso">
          Status:{" "}
          {expired && status === "open"
            ? "expired"
            : status === "paid"
              ? "paid — thank you"
              : status}
        </p>

        {status === "open" && !expired ? (
          <p className="mt-4 text-sm text-muted">
            After you pay, keep your transfer reference. Desk will mark this link paid.
          </p>
        ) : null}

        {link.notes ? (
          <p className="mt-4 text-xs text-muted">{link.notes as string}</p>
        ) : null}
      </div>
    </ConversionShell>
  );
}
