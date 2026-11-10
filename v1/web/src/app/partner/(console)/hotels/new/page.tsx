import { CATALOG_PACKAGES, ONE_TIME_FEES, formatBtn } from "@/lib/pricing-catalog";
import { onboardHotel } from "@/app/actions/platform-admin";
import { getDistributorSession } from "@/lib/platform-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PartnerOnboardPage() {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Onboard hotel</h1>
        <p className="text-sm text-muted-foreground">
          Soft warning if AMC is below catalog MSRP. Fees:{" "}
          {formatBtn(ONE_TIME_FEES.onboardingBtn)} + {formatBtn(ONE_TIME_FEES.trainingBtn)}.
        </p>
      </div>
      <form action={onboardHotel} className="space-y-3 rounded-xl border p-4">
        <input type="hidden" name="distributor_id" value={session.distributorId} />
        <input name="hotel_name" required placeholder="Hotel name" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="owner_name" placeholder="Owner name" className="w-full rounded-md border px-3 py-2 text-sm" />
        <select name="owner_kind" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="leased">
          <option value="independent">Independent</option>
          <option value="leased">Leased portfolio</option>
          <option value="chain">Chain</option>
        </select>
        <select name="package_code" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="classic">
          {CATALOG_PACKAGES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} MSRP {formatBtn(p.msrpBtnMo)}/mo
            </option>
          ))}
        </select>
        <input name="amc_amount_btn" type="number" placeholder="What you charge hotel (BTN/mo)" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="desk_host" placeholder="desk host" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="existing_tenant_id" placeholder="Existing tenant UUID (extra leased property)" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="contact_1" required placeholder="Authorised contact 1" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="contact_2" placeholder="Authorised contact 2" className="w-full rounded-md border px-3 py-2 text-sm" />
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="onboarding_paid" value="1" required /> Onboarding paid
        </label>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="training_paid" value="1" required /> Training paid
        </label>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="accept_conditions" value="1" required /> Conditions accepted
        </label>
        <button type="submit" className="w-full rounded-md bg-primary py-2 text-sm text-primary-foreground">
          Create
        </button>
      </form>
      <Link href="/partner/hotels" className="text-sm underline">
        Cancel
      </Link>
    </div>
  );
}
