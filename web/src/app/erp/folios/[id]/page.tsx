import {
  CompCreditForm,
  DepositLinkForm,
  MarkLinkPaidForm,
  VoidLineButton,
} from "@/components/erp/FolioOpsForms";
import { FolioPaymentForm } from "@/components/erp/FolioPaymentForm";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Folio | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FolioDetailPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, master_folio_id, folio_type, created_at, folio_lines(id, description, total_btn, gst_btn, source_type, status, is_comp, void_reason, created_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!folio) notFound();

  const { data: links } = await admin
    .from("payment_links")
    .select("id, token, amount_btn, status, purpose, created_at, payee_name")
    .eq("folio_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const lines = ((folio.folio_lines as {
    id: string;
    description: string;
    total_btn: number;
    gst_btn: number;
    source_type: string;
    status: string;
    is_comp?: boolean;
    void_reason?: string | null;
    created_at: string;
  }[] | null) ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const posted = lines.filter((line) => line.status === "posted");
  const balance = posted.reduce((sum, line) => sum + Number(line.total_btn), 0);
  const folioStatus = (folio.status as string) ?? "open";

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Folio" />
      <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">
              {(folio.folio_type as string) === "master" ? "Master folio" : "Guest folio"}
            </p>
            <h2 className="mt-2 truncate text-2xl text-espresso md:text-3xl">
              {folio.label as string}
            </h2>
            <p className="mt-1 text-sm text-muted">
              <span className="uppercase tracking-wide">{folioStatus}</span> · booking{" "}
              <span className="font-mono text-espresso/70">
                {(folio.booking_id as string) ?? "—"}
              </span>
              {folio.master_folio_id ? (
                <>
                  {" · master "}
                  <a
                    href={`/erp/folios/${folio.master_folio_id as string}`}
                    className="font-mono underline-offset-4 hover:underline"
                  >
                    {(folio.master_folio_id as string).slice(0, 8)}
                  </a>
                </>
              ) : null}
            </p>
            <p className="mt-1 font-mono text-xs text-espresso/50">{folio.id as string}</p>
          </div>
          <div className="rounded-sm border border-espresso/10 bg-white px-5 py-4 text-right">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
              Balance
            </p>
            <p
              className={`mt-1 text-2xl font-medium tabular-nums ${
                balance > 0 ? "text-maroon" : "text-espresso"
              }`}
            >
              {formatBtn(balance)}
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 space-y-8">
            <div className="border border-espresso/10 bg-white">
              <div className="border-b border-espresso/10 px-5 py-3">
                <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                  Lines ({lines.length})
                </h3>
              </div>
              <ul className="divide-y divide-espresso/10">
                {lines.length === 0 ? (
                  <li className="px-5 py-8 text-sm text-muted">
                    No lines yet. Charges and payments will appear here.
                  </li>
                ) : (
                  lines.map((line) => {
                    const amount = Number(line.total_btn);
                    const isPayment =
                      line.source_type === "payment" || line.source_type === "deposit";
                    const voided = line.status === "voided";
                    return (
                      <li key={line.id} className="px-5 py-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p
                            className={`min-w-0 flex-1 ${
                              voided ? "text-muted line-through" : "text-espresso"
                            }`}
                          >
                            {line.description}
                            {line.is_comp ? (
                              <span className="ml-2 text-[10px] font-semibold tracking-wide text-gold uppercase">
                                comp
                              </span>
                            ) : null}
                          </p>
                          <p
                            className={`tabular-nums ${
                              isPayment ? "text-espresso/70" : "text-espresso"
                            } ${voided ? "line-through opacity-50" : ""}`}
                          >
                            {formatBtn(amount)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          <span className="uppercase tracking-wide">{line.source_type}</span>
                          {" · "}
                          <span className="uppercase tracking-wide">{line.status}</span>
                          {Number(line.gst_btn) > 0
                            ? ` · GST ${formatBtn(Number(line.gst_btn))}`
                            : ""}
                          {line.void_reason ? ` · ${line.void_reason}` : ""}
                        </p>
                        {folioStatus === "open" &&
                        !voided &&
                        !isPayment &&
                        line.source_type !== "comp" ? (
                          <VoidLineButton lineId={line.id} />
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {(links ?? []).length > 0 ? (
              <section>
                <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                  Deposit links
                </h3>
                <ul className="mt-3 border border-espresso/10 bg-white">
                  {(links ?? []).map((l) => (
                    <li
                      key={l.id as string}
                      className="border-b border-espresso/10 px-4 py-3 text-sm last:border-0"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-espresso">
                          {formatBtn(Number(l.amount_btn))} · {l.status as string}
                        </p>
                        <a
                          href={`/pay/${l.token as string}`}
                          className="font-mono text-xs text-maroon underline-offset-4 hover:underline"
                        >
                          /pay/{(l.token as string).slice(0, 8)}…
                        </a>
                      </div>
                      {l.payee_name ? (
                        <p className="mt-1 text-xs text-muted">{l.payee_name as string}</p>
                      ) : null}
                      {(l.status as string) === "open" ? (
                        <MarkLinkPaidForm linkId={l.id as string} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>

          <aside className="space-y-4">
            {folioStatus === "open" ? (
              <>
                <FolioPaymentForm
                  folioId={folio.id as string}
                  suggestedAmount={Math.max(balance, 0)}
                />
                <DepositLinkForm
                  folioId={folio.id as string}
                  bookingId={(folio.booking_id as string | null) ?? null}
                />
                <CompCreditForm folioId={folio.id as string} />
              </>
            ) : (
              <p className="border border-espresso/10 bg-white px-5 py-5 text-sm text-muted">
                Folio is closed.
              </p>
            )}
            <a
              href="/erp"
              className="inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
            >
              ← Back to inbox
            </a>
          </aside>
        </div>
      </main>
    </div>
  );
}
