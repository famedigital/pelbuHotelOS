import { getDistributorSession } from "@/lib/platform-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  supportEnterProperty,
  updateGoLiveChecklist,
} from "@/app/actions/platform-admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PartnerHotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select("id, name, go_live_checklist, go_live_at, distributor_id, package_code")
    .eq("id", id)
    .maybeSingle();
  if (!prop || prop.distributor_id !== session.distributorId) notFound();

  const checklist = (prop.go_live_checklist as Record<string, boolean>) ?? {};

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{prop.name}</h1>
      <p className="text-sm text-muted-foreground">
        {prop.package_code} · {prop.go_live_at ? "Live" : "Not live"}
      </p>
      <form action={updateGoLiveChecklist} className="space-y-2 rounded-xl border p-4">
        <input type="hidden" name="property_id" value={prop.id} />
        {(
          [
            ["rooms_rates", "Rooms + rates"],
            ["staff_trained", "Staff trained"],
            ["night_audit_dry_run", "Night audit dry-run"],
            ["fees_paid", "Fees paid"],
            ["conditions_accepted", "Conditions accepted"],
            ["contacts_set", "Contacts set"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex gap-2 text-sm">
            <input type="checkbox" name={key} value="1" defaultChecked={Boolean(checklist[key])} />
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
          Support enter desk
        </button>
      </form>
      <Link href="/partner/hotels" className="text-sm underline">
        Back
      </Link>
    </div>
  );
}
