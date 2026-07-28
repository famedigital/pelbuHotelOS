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
    .select("id, label, status, booking_id, created_at, folio_lines(id, description, total_btn, gst_btn, source_type, status, created_at)")
    .eq("id", id)
    .maybeSingle();

  if (!folio) notFound();

  const lines = ((folio.folio_lines as {
    id: string;
    description: string;
    total_btn: number;
    gst_btn: number;
    source_type: string;
    status: string;
    created_at: string;
  }[] | null) ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const posted = lines.filter((line) => line.status === "posted");
  const balance = posted.reduce((sum, line) => sum + Number(line.total_btn), 0);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Folio" />
      <main className="mx-auto grid max-w-[1000px] gap-8 px-6 py-10 md:grid-cols-[minmax(0,1fr)_300px] md:px-8">
        <section className="space-y-6">
          <div>
            <p className="text-xs tracking-[0.22em] text-gold uppercase">Guest folio</p>
            <h2 className="mt-2 text-2xl text-espresso">{folio.label as string}</h2>
            <p className="mt-1 text-sm text-muted">
              {(folio.status as string).toUpperCase()} · booking{" "}
              {(folio.booking_id as string) ?? "—"}
            </p>
            <p className="mt-1 font-mono text-xs text-espresso/50">{folio.id as string}</p>
          </div>

          <div className="border border-espresso/10 bg-white">
            <ul className="divide-y divide-espresso/10">
              {lines.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted">No lines yet.</li>
              ) : (
                lines.map((line) => (
                  <li key={line.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-espresso">{line.description}</p>
                      <p className="tabular-nums text-espresso">
                        {formatBtn(Number(line.total_btn))}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {line.source_type} · {line.status}
                      {Number(line.gst_btn) > 0
                        ? ` · GST ${formatBtn(Number(line.gst_btn))}`
                        : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <div className="flex justify-between border-t border-espresso/10 px-4 py-4 text-sm font-medium text-espresso">
              <span>Balance</span>
              <span>{formatBtn(balance)}</span>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          {(folio.status as string) === "open" ? (
            <FolioPaymentForm folioId={folio.id as string} suggestedAmount={Math.max(balance, 0)} />
          ) : (
            <p className="text-sm text-muted">Folio is closed.</p>
          )}
          <a
            href="/erp"
            className="inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
          >
            Back to inbox
          </a>
        </aside>
      </main>
    </div>
  );
}
