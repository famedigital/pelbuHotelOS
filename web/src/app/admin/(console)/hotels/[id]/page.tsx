import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  supportEnterProperty,
  updateGoLiveChecklist,
} from "@/app/actions/platform-admin";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select(
      "id, name, slug, package_code, amc_amount_btn, go_live_checklist, go_live_at, desk_host, is_demo, distributor_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!prop) notFound();

  const checklist = (prop.go_live_checklist as Record<string, boolean>) ?? {};

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{prop.name}</h1>
        <p className="text-sm text-muted-foreground">
          {prop.slug} · {prop.package_code ?? "no package"} · desk{" "}
          {prop.desk_host ?? "—"}
        </p>
        <p className="mt-1 text-sm">
          Go-live: {prop.go_live_at ? new Date(prop.go_live_at).toLocaleString() : "Not live"}
        </p>
      </div>

      <form action={updateGoLiveChecklist} className="space-y-2 rounded-xl border p-4">
        <input type="hidden" name="property_id" value={prop.id} />
        <p className="font-medium">Go-live checklist</p>
        {(
          [
            ["rooms_rates", "Rooms + rates entered"],
            ["staff_trained", "At least 2 staff trained"],
            ["night_audit_dry_run", "Night audit dry-run"],
            ["fees_paid", "Fees paid"],
            ["conditions_accepted", "Conditions accepted"],
            ["contacts_set", "Authorised contacts set"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={key}
              value="1"
              defaultChecked={Boolean(checklist[key])}
            />
            {label}
          </label>
        ))}
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Save checklist
        </button>
      </form>

      <form action={supportEnterProperty}>
        <input type="hidden" name="property_id" value={prop.id} />
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Support enter desk (audited)
        </button>
      </form>

      <div className="print:block">
        <h2 className="font-medium">Order summary (print)</h2>
        <p className="text-sm text-muted-foreground">
          Package {prop.package_code} · AMC {prop.amc_amount_btn ?? "—"} BTN ·
          Conditions accepted with go-live checklist.
        </p>
        <button
          type="button"
          className="mt-2 text-sm underline print:hidden"
          // client print via inline
        >
          Use browser Print for order PDF
        </button>
      </div>

      <Link href="/admin/hotels" className="text-sm underline">
        Back to hotels
      </Link>
    </div>
  );
}
