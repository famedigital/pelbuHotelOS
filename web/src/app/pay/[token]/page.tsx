import { HoldCountdown } from "@/components/book/HoldCountdown";
import { PayProofUploadForm } from "@/components/pay/PayProofUploadForm";
import { formatBtn } from "@/lib/pricing";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pay token | Pelbu Suites",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PayTokenPage({ params }: PageProps) {
  const h = await headers();
  const rl = await rateLimit(`pay:${clientIp(h)}`, {
    limit: 60,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return (
      <main className="min-h-screen bg-ivory px-6 py-16 text-espresso">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-medium tracking-tight">Too many requests</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Please wait a few minutes and try your payment link again.
          </p>
        </div>
      </main>
    );
  }

  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("payment_links")
    .select(
      "id, amount_btn, purpose, status, bank_hint, payee_name, expires_at, booking_id, property_id, proof_submitted_at",
    )
    .eq("token", token)
    .maybeSingle();

  if (!link) notFound();

  const { data: property } = await admin
    .from("properties")
    .select("name, bank_accounts")
    .eq("id", link.property_id)
    .maybeSingle();

  const { data: booking } = link.booking_id
    ? await admin
        .from("bookings")
        .select(
          "id, status, check_in, check_out, contact_name, hold_expires_at, token_required_btn",
        )
        .eq("id", link.booking_id)
        .maybeSingle()
    : { data: null };

  const hotelName = (property?.name as string) ?? "Pelbu Suites";
  const banks = (property?.bank_accounts as { label?: string; bank?: string; account?: string; hint?: string }[]) ?? [];
  const amount = Number(link.amount_btn);
  const isOpen = link.status === "open";
  const isPendingBank = link.status === "pending_bank";
  const isPaid = link.status === "paid";
  const neftHint =
    banks.find((b) => b.hint?.toLowerCase().includes("neft") || b.hint?.toLowerCase().includes("ifsc"))
      ?.hint ??
    "India NEFT: use IFSC + account above · quote booking ref in remarks · allow 2–3 days";

  return (
    <main className="min-h-screen bg-ivory px-6 py-16 text-espresso">
      <div className="mx-auto max-w-lg">
        <p className="text-xs tracking-[0.3em] text-gold uppercase">{hotelName}</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          {isPaid ? "Token received" : "Pay booking token"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isPaid
            ? "Your deposit is recorded. The desk will confirm your stay."
            : isPendingBank
              ? "Your payment screenshot is with the desk. They confirm when the transfer lands (2–3 days)."
            : isOpen
              ? "Transfer the token amount below. Quote your booking reference in the bank remarks. Upload your screenshot when done."
              : "This payment link is no longer open."}
        </p>

        <div className="mt-8 space-y-4 border border-espresso/10 bg-white px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Amount</p>
            <p className="mt-1 text-2xl font-medium">{formatBtn(amount)}</p>
          </div>
          {booking ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Reference
                </p>
                <p className="mt-1 font-mono text-sm break-all">{booking.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Check-in
                  </p>
                  <p className="mt-1">{booking.check_in as string}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Check-out
                  </p>
                  <p className="mt-1">{booking.check_out as string}</p>
                </div>
              </div>
              {booking.hold_expires_at && isOpen ? (
                <HoldCountdown
                  expiresAt={booking.hold_expires_at as string}
                  formattedExpiry={new Date(
                    booking.hold_expires_at as string,
                  ).toLocaleString("en-BT", { timeZone: "Asia/Thimphu" })}
                />
              ) : null}
            </>
          ) : null}

          {link.bank_hint ? (
            <p className="text-sm text-muted-foreground">{link.bank_hint as string}</p>
          ) : null}

          {banks.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {banks.map((b, i) => (
                <li key={i} className="border-t border-espresso/10 pt-2">
                  <p className="font-medium">{b.label ?? "Bank"}</p>
                  {b.bank ? <p className="text-muted-foreground">{b.bank}</p> : null}
                  {b.account ? (
                    <p className="font-mono text-xs">{b.account}</p>
                  ) : null}
                  {b.hint ? <p className="text-muted-foreground">{b.hint}</p> : null}
                </li>
              ))}
              <li className="border-t border-espresso/10 pt-2 text-muted-foreground">
                {neftHint}
              </li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{neftHint}</p>
          )}

          {isOpen ? (
            <PayProofUploadForm token={token} neftHint={neftHint} />
          ) : null}

          <p className="text-xs text-muted-foreground">
            Status: <span className="capitalize text-espresso">{link.status as string}</span>
          </p>
        </div>

        <a
          href="/book"
          className="mt-8 inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
        >
          Back to booking
        </a>
      </div>
    </main>
  );
}
