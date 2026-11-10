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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const hotelCode = typeof sp.hotel_code === "string" ? sp.hotel_code : null;
  const userId = typeof sp.user_id === "string" ? sp.user_id : null;
  const password = typeof sp.password === "string" ? sp.password : null;

  const admin = createSupabaseAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select(
      "id, name, slug, hotel_code, dzongkhag_code, area_code, package_code, amc_amount_btn, go_live_checklist, go_live_at, desk_host, is_demo, distributor_id, setup_completed_at",
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
          Desk login code{" "}
          <span className="font-mono uppercase">
            {prop.hotel_code ?? prop.slug}
          </span>
          {prop.dzongkhag_code ? (
            <>
              {" "}
              · {prop.dzongkhag_code}
              {prop.area_code ?? ""}
            </>
          ) : null}{" "}
          · slug <span className="font-mono">{prop.slug}</span> ·{" "}
          {prop.package_code ?? "no package"} · desk {prop.desk_host ?? "—"}
        </p>
        <p className="mt-1 text-sm">
          Go-live: {prop.go_live_at ? new Date(prop.go_live_at).toLocaleString() : "Not live"}
          {" · "}
          Setup: {prop.setup_completed_at ? "complete" : "wizard pending"}
        </p>
      </div>

      {hotelCode && userId && password ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <p className="font-medium text-amber-950 dark:text-amber-100">
            Owner desk login (show once — save securely)
          </p>
          <dl className="grid gap-1 font-mono text-sm">
            <div>
              <dt className="inline text-muted-foreground">Hotel code: </dt>
              <dd className="inline uppercase">{hotelCode}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">User ID: </dt>
              <dd className="inline">{userId}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Password: </dt>
              <dd className="inline">{password}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            First owner login opens the setup wizard until setup is marked complete.
          </p>
        </div>
      ) : null}

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
