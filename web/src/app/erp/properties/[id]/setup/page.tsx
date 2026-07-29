import {
  savePropertyBanksAndComplete,
  savePropertyDepositRules,
  savePropertyIncomeStreams,
  savePropertyRoomsStep,
} from "@/app/actions/erp-properties";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  listProperties,
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function PropertySetupPage({
  params,
  searchParams,
}: PageProps) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const property = await loadProperty(admin, id);
  if (!property) notFound();

  const step = Math.min(
    5,
    Math.max(2, Number(sp.step ?? property.setup_step) || 2),
  );
  const [activeId, properties, deposit, roomTypes, ttl] = await Promise.all([
    resolveActivePropertyId(admin),
    listProperties(admin),
    admin
      .from("property_deposit_rules")
      .select("mode, floor_btn, percent, bank_hint")
      .eq("property_id", id)
      .maybeSingle(),
    admin
      .from("room_types")
      .select("id, code, name, unit_count, inventory_kind")
      .eq("property_id", id)
      .order("code"),
    admin
      .from("hold_ttl_rules")
      .select("season_kind, ttl_hours")
      .eq("property_id", id)
      .eq("source", "client"),
  ]);

  const ttlMap = Object.fromEntries(
    (ttl.data ?? []).map((r) => [r.season_kind as string, Number(r.ttl_hours)]),
  );

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader
        title={`Setup Â· ${property.name}`}
        properties={properties}
        activePropertyId={activeId}
      />
      <main className="mx-auto max-w-xl space-y-8 px-6 py-10 md:px-8">
        <div>
          <p className="text-xs tracking-[0.25em] text-gold uppercase">
            Step {step} of 5
          </p>
          <h2 className="mt-2 text-2xl text-espresso">
            {step === 2
              ? "Rooms & rates"
              : step === 3
                ? "Income streams"
                : step === 4
                  ? "Holds & deposits"
                  : "Banks & go live"}
          </h2>
          <nav className="mt-4 flex flex-wrap gap-2 text-xs">
            {[2, 3, 4, 5].map((s) => (
              <a
                key={s}
                href={`/erp/properties/${id}/setup?step=${s}`}
                className={
                  s === step
                    ? "font-medium text-espresso"
                    : "text-muted-foreground underline-offset-4 hover:underline"
                }
              >
                {s}
              </a>
            ))}
          </nav>
        </div>

        {step === 2 ? (
          <div className="space-y-6">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(roomTypes.data ?? []).map((r) => (
                <li key={r.id as string}>
                  <span className="font-medium text-espresso">
                    {r.code as string}
                  </span>{" "}
                  Â· {r.name as string} Â· {Number(r.unit_count ?? 0)} units
                </li>
              ))}
              {(roomTypes.data ?? []).length === 0 ? (
                <li>No room types yet — add one below.</li>
              ) : null}
            </ul>
            <PropertyWizardForm action={savePropertyRoomsStep}>
              <input type="hidden" name="property_id" value={id} />
              <label className="block text-sm text-muted-foreground">
                Code
                <input
                  name="code"
                  required
                  placeholder="deluxe"
                  className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm text-muted-foreground">
                Name
                <input
                  name="name"
                  required
                  placeholder="Deluxe Suite"
                  className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm text-muted-foreground">
                Units
                <input
                  name="unit_count"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <input type="hidden" name="inventory_kind" value="sellable_guest" />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-5 text-sm font-medium text-espresso"
              >
                Add room type
              </button>
            </PropertyWizardForm>
            <a
              href={`/erp/properties/${id}/setup?step=3`}
              className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
            >
              Continue to income streams
            </a>
          </div>
        ) : null}

        {step === 3 ? (
          <PropertyWizardForm action={savePropertyIncomeStreams}>
            <input type="hidden" name="property_id" value={id} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-espresso">
                F&B outlets
              </legend>
              {["cafe", "pastry", "restaurant", "bar"].map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm capitalize">
                  <input
                    type="checkbox"
                    name="outlets"
                    value={o}
                    defaultChecked={property.income_streams.outlets.includes(o)}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-espresso">
                Services
              </legend>
              {["spa", "meeting", "steam"].map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm capitalize">
                  <input
                    type="checkbox"
                    name="services"
                    value={o}
                    defaultChecked={property.income_streams.services.includes(o)}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-espresso">
                Guest services
              </legend>
              {["taxi", "shop", "other"].map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm capitalize">
                  <input
                    type="checkbox"
                    name="guest_services"
                    value={o}
                    defaultChecked={property.income_streams.guest_services.includes(
                      o,
                    )}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="channel"
                value="1"
                defaultChecked={property.income_streams.channel}
              />
              Channel / OTA (configure maps later)
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
            >
              Save and continue
            </button>
          </PropertyWizardForm>
        ) : null}

        {step === 4 ? (
          <PropertyWizardForm action={savePropertyDepositRules}>
            <input type="hidden" name="property_id" value={id} />
            <label className="block text-sm text-muted-foreground">
              Token mode
              <select
                name="mode"
                defaultValue={deposit.data?.mode ?? "one_night"}
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              >
                <option value="one_night">One night (min floor)</option>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percent of stay</option>
              </select>
            </label>
            <label className="block text-sm text-muted-foreground">
              Floor BTN
              <input
                name="floor_btn"
                type="number"
                min={0}
                defaultValue={Number(deposit.data?.floor_btn ?? 2000)}
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm text-muted-foreground">
              Percent (if percent mode)
              <input
                name="percent"
                type="number"
                min={1}
                max={100}
                defaultValue={
                  deposit.data?.percent != null
                    ? Number(deposit.data.percent)
                    : ""
                }
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <p className="text-sm font-medium text-espresso">
              Web client TTL (hours)
            </p>
            {(["peak", "lean", "off"] as const).map((s) => (
              <label key={s} className="block text-sm text-muted-foreground capitalize">
                {s}
                <input
                  name={`ttl_client_${s}`}
                  type="number"
                  min={1}
                  defaultValue={ttlMap[s] ?? (s === "peak" ? 12 : s === "lean" ? 48 : 168)}
                  className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
                />
              </label>
            ))}
            <label className="block text-sm text-muted-foreground">
              Bank hint on pay link
              <textarea
                name="bank_hint"
                rows={2}
                defaultValue={deposit.data?.bank_hint ?? ""}
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
            >
              Save and continue
            </button>
          </PropertyWizardForm>
        ) : null}

        {step === 5 ? (
          <PropertyWizardForm action={savePropertyBanksAndComplete}>
            <input type="hidden" name="property_id" value={id} />
            <label className="block text-sm text-muted-foreground">
              Account label
              <input
                name="bank_label"
                defaultValue={property.bank_accounts[0]?.label ?? ""}
                placeholder="BoB current"
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm text-muted-foreground">
              Bank
              <input
                name="bank_name"
                defaultValue={property.bank_accounts[0]?.bank ?? ""}
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm text-muted-foreground">
              Account number
              <input
                name="bank_account"
                defaultValue={property.bank_accounts[0]?.account ?? ""}
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm text-muted-foreground">
              Guest-facing hint
              <textarea
                name="bank_hint"
                rows={2}
                defaultValue={property.bank_accounts[0]?.hint ?? ""}
                className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
            >
              Finish setup
            </button>
          </PropertyWizardForm>
        ) : null}
      </main>
    </div>
  );
}
