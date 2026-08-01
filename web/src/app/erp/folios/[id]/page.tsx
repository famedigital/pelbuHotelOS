import {
  AttachToMasterForm,
  CompCreditForm,
  DepositLinkForm,
  IssueCreditNoteButton,
  IssueInvoiceButton,
  MarkLinkPaidForm,
  PromoteToMasterForm,
  TransferLineForm,
  VoidLineButton,
} from "@/components/erp/FolioOpsForms";
import { FolioPaymentForm } from "@/components/erp/FolioPaymentForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { netFolioBalance } from "@/lib/folio/balance";
import { resolveActivePropertyId } from "@/lib/property-context";
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
  const activePropertyId = await resolveActivePropertyId(admin);

  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, master_folio_id, folio_type, property_id, created_at, folio_lines(id, description, total_btn, gst_btn, service_charge_btn, service_charge_applied, source_type, status, is_comp, void_reason, reverses_line_id, created_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!folio) notFound();

  try {
    assertDeskProperty(
      activePropertyId,
      folio.property_id as string,
      "Folio",
    );
  } catch {
    notFound();
  }

  const { data: links } = await admin
    .from("payment_links")
    .select("id, token, amount_btn, status, purpose, created_at, payee_name")
    .eq("folio_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: invoiceDoc } = await admin
    .from("fiscal_documents")
    .select("id, doc_no")
    .eq("folio_id", id)
    .eq("doc_kind", "invoice")
    .eq("status", "issued")
    .maybeSingle();

  const { data: siblingFolios } = folio.booking_id
    ? await admin
        .from("folios")
        .select("id, label, status")
        .eq("property_id", activePropertyId)
        .eq("booking_id", folio.booking_id as string)
        .eq("status", "open")
        .neq("id", id)
        .limit(20)
    : { data: [] as { id: string; label: string; status: string }[] };

  const transferTargets = (siblingFolios ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
  }));

  const { data: masterRows } = await admin
    .from("folios")
    .select("id, label")
    .eq("property_id", activePropertyId)
    .eq("status", "open")
    .eq("folio_type", "master")
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(40);
  const masterCandidates = (masterRows ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
  }));

  const { data: childFolios } =
    (folio.folio_type as string) === "master"
      ? await admin
          .from("folios")
          .select("id, label, status")
          .eq("property_id", activePropertyId)
          .eq("master_folio_id", id)
          .order("created_at", { ascending: true })
          .limit(40)
      : { data: [] as { id: string; label: string; status: string }[] };

  const lines = ((folio.folio_lines as {
    id: string;
    description: string;
    total_btn: number;
    gst_btn: number;
    service_charge_btn?: number;
    service_charge_applied?: boolean;
    source_type: string;
    status: string;
    is_comp?: boolean;
    void_reason?: string | null;
    reverses_line_id?: string | null;
    created_at: string;
  }[] | null) ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const posted = lines.filter((line) => line.status === "posted");
  const balance = netFolioBalance(lines);
  const folioStatus = (folio.status as string) ?? "open";

  return (
    <div className="erp mx-auto w-full max-w-[1100px] p-4 md:p-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {(folio.folio_type as string) === "master" ? "Master folio" : "Guest folio"}
          </p>
          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {folio.label as string}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="tracking-wide uppercase">{folioStatus}</span> · booking{" "}
            <span className="font-mono text-foreground/70">
              {(folio.booking_id as string) ?? "—"}
            </span>
            {folio.master_folio_id ? (
              <>
                {" · master "}
                <a
                  href={`/erp/folios/${folio.master_folio_id as string}`}
                  className="font-mono text-accent underline-offset-4 hover:underline"
                >
                  {(folio.master_folio_id as string).slice(0, 8)}
                </a>
              </>
            ) : null}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {folio.id as string}
          </p>
        </div>
        <Card className="gap-1 py-4">
          <CardContent className="text-right">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Balance
            </p>
            <p
              className={`mt-1 text-2xl font-medium tabular-nums ${
                balance > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatBtn(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-8">
          <Card className="gap-0 p-0">
            <CardHeader className="border-b px-5 py-3">
              <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Lines ({lines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {lines.length === 0 ? (
                  <li className="px-5 py-8 text-sm text-muted-foreground">
                    No lines yet. Room rent posts at night audit (midnight
                    Thimphu cron or manual run on Night audit). POS, laundry,
                    and desk charges appear here when posted.
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
                              voided ? "text-muted-foreground line-through" : "text-foreground"
                            }`}
                          >
                            {line.description}
                            {line.is_comp ? (
                              <span className="ml-2 text-[10px] font-semibold tracking-wide text-accent uppercase">
                                comp
                              </span>
                            ) : null}
                          </p>
                          <p
                            className={`tabular-nums ${
                              isPayment ? "text-foreground/70" : "text-foreground"
                            } ${voided ? "opacity-50 line-through" : ""}`}
                          >
                            {formatBtn(amount)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="tracking-wide uppercase">{line.source_type}</span>
                          {" · "}
                          <span className="tracking-wide uppercase">{line.status}</span>
                          {line.service_charge_applied &&
                          Number(line.service_charge_btn ?? 0) > 0
                            ? ` · SC ${formatBtn(Number(line.service_charge_btn ?? 0))}`
                            : ""}
                          {Number(line.gst_btn) > 0
                            ? ` · GST ${formatBtn(Number(line.gst_btn))}`
                            : ""}
                          {line.void_reason ? ` · ${line.void_reason}` : ""}
                        </p>
                        {folioStatus === "open" &&
                        !voided &&
                        !isPayment &&
                        line.source_type !== "comp" ? (
                          <>
                            <VoidLineButton lineId={line.id} />
                            <TransferLineForm
                              lineId={line.id}
                              siblingFolios={transferTargets}
                            />
                          </>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </CardContent>
          </Card>

          {(links ?? []).length > 0 ? (
            <section>
              <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Deposit links
              </h3>
              <Card className="mt-3 gap-0 p-0">
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {(links ?? []).map((l) => (
                      <li key={l.id as string} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium text-foreground">
                            {formatBtn(Number(l.amount_btn))} · {l.status as string}
                          </p>
                          <a
                            href={`/pay/${l.token as string}`}
                            className="font-mono text-xs text-accent underline-offset-4 hover:underline"
                          >
                            /pay/{(l.token as string).slice(0, 8)}…
                          </a>
                        </div>
                        {l.payee_name ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {l.payee_name as string}
                          </p>
                        ) : null}
                        {(l.status as string) === "open" ? (
                          <MarkLinkPaidForm linkId={l.id as string} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
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
              {(folio.folio_type as string) !== "master" && !folio.master_folio_id ? (
                <PromoteToMasterForm folioId={folio.id as string} />
              ) : null}
              {(folio.folio_type as string) !== "master" ? (
                <AttachToMasterForm
                  folioId={folio.id as string}
                  masterCandidates={masterCandidates}
                />
              ) : null}
            </>
          ) : (
            <Card>
              <CardContent className="py-5 text-sm text-muted-foreground">
                Folio is closed.
              </CardContent>
            </Card>
          )}
          {(folio.folio_type as string) === "master" && (childFolios ?? []).length > 0 ? (
            <Card className="gap-0 p-0">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                  Linked guest folios
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {(childFolios ?? []).map((c) => (
                    <li key={c.id as string} className="px-4 py-2 text-sm">
                      <a
                        href={`/erp/folios/${c.id as string}`}
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        {(c.label as string) || (c.id as string).slice(0, 8)}
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground uppercase">
                        {c.status as string}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <a
            href="/erp/folios"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            City ledger list
          </a>
          <IssueInvoiceButton
            folioId={folio.id as string}
            invoiceNo={(invoiceDoc?.doc_no as string | undefined) ?? null}
            invoiceDocId={(invoiceDoc?.id as string | undefined) ?? null}
          />
          <IssueCreditNoteButton folioId={folio.id as string} />
          <a
            href={`/erp/folios/${folio.id as string}/receipt`}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium text-foreground hover:bg-muted"
          >
            Print receipt
          </a>
          <a
            href="/erp"
            className="inline-flex h-11 items-center text-sm text-foreground underline-offset-4 hover:underline"
          >
            ← Back to dashboard
          </a>
        </aside>
      </div>
    </div>
  );
}
