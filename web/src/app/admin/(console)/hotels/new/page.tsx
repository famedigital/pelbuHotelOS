import { CATALOG_PACKAGES, ONE_TIME_FEES, formatBtn } from "@/lib/pricing-catalog";
import { onboardHotel } from "@/app/actions/platform-admin";
import { HotelLocationFields } from "@/components/platform/HotelLocationFields";
import { buildHotelCode, nextHotelCodeSequence } from "@/lib/hotel-codes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboard hotel", robots: { index: false, follow: false } };

export default async function AdminOnboardHotelPage() {
  let distributors: Array<{ id: string; name: string }> = [];
  let dzongkhags: Array<{ code: string; name: string }> = [];
  let areas: Array<{ dzongkhag_code: string; code: string; name: string }> = [];
  let suggestedCode = "THI01001";
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: dists }, { data: dz }, { data: ar }] = await Promise.all([
      admin.from("distributors").select("id, name").eq("status", "active"),
      admin
        .from("bhutan_dzongkhags")
        .select("code, name")
        .order("sort_order", { ascending: true }),
      admin
        .from("bhutan_hotel_areas")
        .select("dzongkhag_code, code, name")
        .order("sort_order", { ascending: true }),
    ]);
    distributors = dists ?? [];
    dzongkhags = dz ?? [];
    areas = ar ?? [];
    const seq = await nextHotelCodeSequence(admin, "THI", "01");
    suggestedCode = buildHotelCode("THI", "01", seq);
  } catch {
    distributors = [];
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Onboard hotel</h1>
        <p className="text-sm text-muted-foreground">
          Fees: onboarding {formatBtn(ONE_TIME_FEES.onboardingBtn)} + training{" "}
          {formatBtn(ONE_TIME_FEES.trainingBtn)}. Conditions must be accepted.
        </p>
      </div>
      <form action={onboardHotel} className="space-y-3 rounded-xl border p-4">
        <input name="hotel_name" required placeholder="Hotel / property name" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="owner_name" placeholder="Owner / tenant name" className="w-full rounded-md border px-3 py-2 text-sm" />
        <HotelLocationFields
          dzongkhags={
            dzongkhags.length
              ? dzongkhags
              : [{ code: "THI", name: "Thimphu" }]
          }
          areas={
            areas.length
              ? areas
              : [
                  { dzongkhag_code: "THI", code: "01", name: "Main town" },
                  { dzongkhag_code: "THI", code: "02", name: "Olakha" },
                ]
          }
          suggestedCode={suggestedCode}
        />
        <select name="owner_kind" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="leased">
          <option value="independent">Independent</option>
          <option value="leased">Leased portfolio</option>
          <option value="chain">Chain</option>
        </select>
        <select name="package_code" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="classic">
          {CATALOG_PACKAGES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} — {formatBtn(p.msrpBtnMo)}/mo
            </option>
          ))}
        </select>
        <input name="amc_amount_btn" type="number" placeholder="AMC BTN / month charged to hotel" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="desk_host" placeholder="desk host e.g. desk.hotel.bt" className="w-full rounded-md border px-3 py-2 text-sm" />
        <select name="distributor_id" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="">
          <option value="">Fame direct (no distributor)</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input name="contact_1" required placeholder="Authorised contact phone 1" className="w-full rounded-md border px-3 py-2 text-sm" />
        <input name="contact_2" placeholder="Authorised contact phone 2 (optional)" className="w-full rounded-md border px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="onboarding_paid" value="1" required />
          Onboarding fee paid
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="training_paid" value="1" required />
          Training fee paid
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="accept_conditions" value="1" required />
          Client accepted /conditions
        </label>
        <button type="submit" className="w-full rounded-md bg-primary py-2 text-sm text-primary-foreground">
          Create hotel
        </button>
      </form>
      <Link href="/admin/hotels" className="text-sm underline">
        Cancel
      </Link>
    </div>
  );
}
