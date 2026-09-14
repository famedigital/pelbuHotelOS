import {
  continuePropertyRoomsStep,
  reopenPropertySetup,
  savePropertyAgentStep,
  savePropertyBanksAndComplete,
  savePropertyCommercialStep,
  savePropertyIdentityStep,
  savePropertyRatesStep,
  savePropertyRoomsStep,
  savePropertyStaffStep,
} from "@/app/actions/erp-properties";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { PropertySetupModalShell } from "@/components/erp/setup/PropertySetupModalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hotel setup | Hotel OS",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const selectClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const STEP_TITLES: Record<number, string> = {
  1: "Property identity",
  2: "Rooms & inventory",
  3: "Rates & seasons",
  4: "Outlets & deposits",
  5: "Team, banks & go live",
};

const STEP_BLURBS: Record<number, string> = {
  1: "Legal name, address, TPN, and contact details used on invoices and guest vouchers.",
  2: "Room categories and physical doors. Only “Sellable guest” types get public/agent rates on the next step — guide, driver, and staff beds are inventory only.",
  3: "Public and agent nightly rates for sellable guest categories only. Comp/staff room types from step 2 stay on the rack without a rate card.",
  4: "Which F&B / spa outlets run at this hotel, hold TTL, and deposit token rules.",
  5: "Optional staff and travel agents, then bank details. Finishing marks setup complete.",
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

  const [
    depositRes,
    roomTypesRes,
    unitsRes,
    ratesRes,
    seasonsRes,
    ttlRes,
    staffRes,
    agentsRes,
  ] = await Promise.all([
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
      .from("room_units")
      .select("id, room_type_id")
      .eq("property_id", id),
    admin
      .from("room_rates")
      .select("room_type_id, season_kind, rate_tier, amount_btn")
      .eq("property_id", id)
      .in("rate_tier", ["public", "agents"]),
    admin
      .from("seasons")
      .select("kind, starts_on, ends_on")
      .eq("property_id", id)
      .order("starts_on"),
    admin
      .from("hold_ttl_rules")
      .select("season_kind, ttl_hours")
      .eq("property_id", id)
      .eq("source", "client"),
    admin
      .from("staff_members")
      .select("id, full_name, role_label, status")
      .eq("property_id", id)
      .eq("status", "active")
      .order("full_name")
      .limit(12),
    admin
      .from("agents")
      .select("id, company_name, market, status")
      .in("status", ["approved", "demo"])
      .order("company_name")
      .limit(12),
  ]);

  const roomTypes = roomTypesRes.data ?? [];
  const unitByType = new Map<string, number>();
  for (const u of unitsRes.data ?? []) {
    const tid = u.room_type_id as string;
    unitByType.set(tid, (unitByType.get(tid) ?? 0) + 1);
  }
  const totalUnits = (unitsRes.data ?? []).length;
  const rateRows = ratesRes.data ?? [];

  // Smart default: resume incomplete progress; jump to the gap after a wipe.
  let defaultStep = Number(property.setup_step) || 1;
  if (property.setup_completed_at) {
    if (totalUnits < 1 || roomTypes.length < 1) defaultStep = 2;
    else if (rateRows.length < 1) defaultStep = 3;
    else defaultStep = 1;
  } else if (totalUnits < 1 || roomTypes.length < 1) {
    defaultStep = Math.min(defaultStep, 2);
  } else if (rateRows.length < 1) {
    defaultStep = Math.min(Math.max(defaultStep, 3), 3);
  }
  const requested = Number(sp.step ?? defaultStep) || defaultStep;
  const step = Math.min(5, Math.max(1, requested));

  const rateMap = new Map<string, number>();
  for (const r of rateRows) {
    const key = `${r.room_type_id}|${r.season_kind}|${r.rate_tier}`;
    rateMap.set(key, Number(r.amount_btn));
  }

  const ttlMap = Object.fromEntries(
    (ttlRes.data ?? []).map((r) => [r.season_kind as string, Number(r.ttl_hours)]),
  );

  const sellable = roomTypes.filter(
    (r) => (r.inventory_kind as string) === "sellable_guest",
  );
  const nonSellable = roomTypes.filter(
    (r) => (r.inventory_kind as string) !== "sellable_guest",
  );
  const completed = Boolean(property.setup_completed_at);
  const emptyInventory = totalUnits === 0;

  return (
    <PropertySetupModalShell
      propertyId={id}
      propertyName={property.name}
      step={step}
      title={STEP_TITLES[step] ?? "Setup"}
      blurb={STEP_BLURBS[step] ?? ""}
      completed={completed}
      footerNote={
        <>
          Step {step} of 5
          {" · "}
          <Link href="/erp" className="underline-offset-2 hover:underline">
            Desk
          </Link>
          {" · "}
          <Link
            href="/erp/settings"
            className="underline-offset-2 hover:underline"
          >
            Settings
          </Link>
          {" · "}
          <Link
            href="/erp/properties/new"
            className="underline-offset-2 hover:underline"
          >
            Add hotel
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {emptyInventory && step !== 2 ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            No physical rooms on this property.{" "}
            <Link
              href={`/erp/properties/${id}/setup?step=2`}
              className="font-medium underline-offset-2 hover:underline"
            >
              Add inventory →
            </Link>
          </p>
        ) : null}

      {/* —— Step 1: Identity —— */}
      {step === 1 ? (
        <PropertyWizardForm action={savePropertyIdentityStep}>
          <input type="hidden" name="property_id" value={id} />
          <div className="space-y-1.5">
            <Label htmlFor="name">Hotel name</Label>
            <Input id="name" name="name" required defaultValue={property.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input
              id="legal_name"
              name="legal_name"
              defaultValue={property.legal_name ?? property.name}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={property.address ?? ""}
              className={fieldClass}
              placeholder="Olakha, Thimphu"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={property.phone ?? ""}
                placeholder="+975 …"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={property.email ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tax_id">TPN / GST tax ID</Label>
              <Input
                id="tax_id"
                name="tax_id"
                defaultValue={property.tax_id ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={property.timezone || "Asia/Thimphu"}
              />
            </div>
          </div>
          <Button type="submit" className="h-11 w-full">
            Save and continue
          </Button>
        </PropertyWizardForm>
      ) : null}

      {/* —— Step 2: Rooms —— */}
      {step === 2 ? (
        <div className="space-y-6">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {roomTypes.map((r) => {
              const doors = unitByType.get(r.id as string) ?? 0;
              const planned = Number(r.unit_count ?? 0);
              const kind = (r.inventory_kind as string) || "sellable_guest";
              const isSellable = kind === "sellable_guest";
              return (
                <li key={r.id as string} className="flex flex-wrap gap-x-2">
                  <span className="font-medium text-foreground">
                    {r.code as string}
                  </span>
                  <span>· {r.name as string}</span>
                  <span>· {kind.replace(/_/g, " ")}</span>
                  <span>
                    · {doors}/{planned} doors
                    {doors === 0 && planned > 0 ? " (will recreate on continue)" : ""}
                  </span>
                  <span
                    className={
                      isSellable
                        ? "text-foreground/80"
                        : "text-muted-foreground"
                    }
                  >
                    · {isSellable ? "rates on step 3" : "no public rate"}
                  </span>
                </li>
              );
            })}
            {roomTypes.length === 0 ? (
              <li className="text-foreground">
                No room types yet — add a sellable guest category below.
              </li>
            ) : null}
          </ul>

          <PropertyWizardForm action={savePropertyRoomsStep}>
            <input type="hidden" name="property_id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" required placeholder="deluxe" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Deluxe Suite"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="unit_count">Doors / units</Label>
                <Input
                  id="unit_count"
                  name="unit_count"
                  type="number"
                  min={0}
                  max={500}
                  defaultValue={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inventory_kind">Inventory kind</Label>
                <select
                  id="inventory_kind"
                  name="inventory_kind"
                  defaultValue="sellable_guest"
                  className={selectClass}
                >
                  <option value="sellable_guest">Sellable guest</option>
                  <option value="guide_comp">Guide comp</option>
                  <option value="driver_comp">Driver comp</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saving creates door labels like DELUXE-01. Re-saving the same code
              updates count and regenerates missing doors after a wipe.
            </p>
            <Button type="submit" variant="outline" className="h-11 w-full">
              Add / update room type
            </Button>
          </PropertyWizardForm>

          <PropertyWizardForm action={continuePropertyRoomsStep}>
            <input type="hidden" name="property_id" value={id} />
            <Button type="submit" className="h-11 w-full">
              Continue to rates
            </Button>
          </PropertyWizardForm>
        </div>
      ) : null}

      {/* —— Step 3: Rates —— */}
      {step === 3 ? (
        <div className="space-y-6">
          {(seasonsRes.data ?? []).length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {(seasonsRes.data ?? []).map((s, i) => (
                <li key={`${s.kind}-${s.starts_on}-${i}`}>
                  <span className="capitalize text-foreground">{s.kind as string}</span>
                  : {s.starts_on as string} → {s.ends_on as string}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Season windows will be created when you save rates (peak / lean /
              off for the current year). Refine dates later under{" "}
              <Link href="/erp/rates" className="underline-offset-2 hover:underline">
                Room rates
              </Link>
              .
            </p>
          )}

          {sellable.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                No sellable guest categories yet. Rates only apply to inventory
                kind “Sellable guest” — guide, driver, and staff types from step
                2 do not appear here.
              </p>
              <Button asChild variant="outline" className="h-11 w-full">
                <Link href={`/erp/properties/${id}/setup?step=2`}>
                  Back to rooms
                </Link>
              </Button>
            </div>
          ) : (
            <PropertyWizardForm action={savePropertyRatesStep}>
              <input type="hidden" name="property_id" value={id} />
              {nonSellable.length > 0 ? (
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  From step 2, rate cards only for sellable guest (
                  {sellable.map((r) => r.code as string).join(", ")}
                  ). Not priced here:{" "}
                  {nonSellable
                    .map(
                      (r) =>
                        `${r.code as string} (${(r.inventory_kind as string).replace(/_/g, " ")})`,
                    )
                    .join(", ")}
                  .
                </p>
              ) : null}
              {sellable.map((rt) => (
                <fieldset
                  key={rt.id as string}
                  className="space-y-3 rounded-lg border border-border p-4"
                >
                  <legend className="px-1 text-sm font-medium text-foreground">
                    {rt.name as string}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({rt.code as string})
                    </span>
                  </legend>
                  {(["peak", "lean", "off"] as const).map((season) => (
                    <div
                      key={season}
                      className="grid gap-3 sm:grid-cols-[4rem_1fr_1fr] sm:items-end"
                    >
                      <p className="text-xs font-medium capitalize text-muted-foreground sm:pb-2.5">
                        {season}
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor={`rate_${rt.id}_${season}_public`}>
                          Public Nu / night
                        </Label>
                        <Input
                          id={`rate_${rt.id}_${season}_public`}
                          name={`rate_${rt.id as string}_${season}_public`}
                          type="number"
                          min={0}
                          step="1"
                          placeholder="e.g. 5500"
                          defaultValue={
                            rateMap.get(`${rt.id}|${season}|public`) ?? ""
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`rate_${rt.id}_${season}_agents`}>
                          Agent Nu / night
                        </Label>
                        <Input
                          id={`rate_${rt.id}_${season}_agents`}
                          name={`rate_${rt.id as string}_${season}_agents`}
                          type="number"
                          min={0}
                          step="1"
                          placeholder="e.g. 4700"
                          defaultValue={
                            rateMap.get(`${rt.id}|${season}|agents`) ?? ""
                          }
                        />
                      </div>
                    </div>
                  ))}
                </fieldset>
              ))}
              <p className="text-xs text-muted-foreground">
                Both fields are full nightly rates in Ngultrum (not a percent).
                Leave agent blank to auto-set ~85% of public for that season.
                Friends, family, MOU tiers fill from public/agent when missing.
                Full matrix:{" "}
                <Link href="/erp/rates" className="underline-offset-2 hover:underline">
                  /erp/rates
                </Link>
                .
              </p>
              <Button type="submit" className="h-11 w-full">
                Save rates and continue
              </Button>
            </PropertyWizardForm>
          )}
        </div>
      ) : null}

      {/* —— Step 4: Commercial —— */}
      {step === 4 ? (
        <PropertyWizardForm action={savePropertyCommercialStep}>
          <input type="hidden" name="property_id" value={id} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              F&amp;B outlets
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
            <legend className="text-sm font-medium text-foreground">
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
            <legend className="text-sm font-medium text-foreground">
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
            Channel / OTA (map Channex later under Channel desk)
          </label>

          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-sm font-medium text-foreground">
              Holds &amp; deposits
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="mode">Token mode</Label>
              <select
                id="mode"
                name="mode"
                defaultValue={depositRes.data?.mode ?? "one_night"}
                className={selectClass}
              >
                <option value="one_night">One night (min floor)</option>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percent of stay</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="floor_btn">Floor BTN</Label>
                <Input
                  id="floor_btn"
                  name="floor_btn"
                  type="number"
                  min={0}
                  defaultValue={Number(depositRes.data?.floor_btn ?? 2000)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="percent">Percent (if percent mode)</Label>
                <Input
                  id="percent"
                  name="percent"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={
                    depositRes.data?.percent != null
                      ? Number(depositRes.data.percent)
                      : ""
                  }
                />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground">
              Web client hold TTL (hours)
            </p>
            {(["peak", "lean", "off"] as const).map((s) => (
              <div key={s} className="space-y-1.5">
                <Label htmlFor={`ttl_client_${s}`} className="capitalize">
                  {s}
                </Label>
                <Input
                  id={`ttl_client_${s}`}
                  name={`ttl_client_${s}`}
                  type="number"
                  min={1}
                  defaultValue={
                    ttlMap[s] ?? (s === "peak" ? 12 : s === "lean" ? 48 : 168)
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="bank_hint">Bank hint on pay link</Label>
              <Textarea
                id="bank_hint"
                name="bank_hint"
                rows={2}
                defaultValue={depositRes.data?.bank_hint ?? ""}
                className={fieldClass}
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full">
            Save and continue
          </Button>
        </PropertyWizardForm>
      ) : null}

      {/* —— Step 5: Team + banks —— */}
      {step === 5 ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">Staff (optional)</h3>
              <p className="text-xs text-muted-foreground">
                Add desk / F&amp;B / HK people here, or finish and manage under HR.
              </p>
            </div>
            {(staffRes.data ?? []).length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(staffRes.data ?? []).map((s) => (
                  <li key={s.id as string}>
                    <span className="text-foreground">{s.full_name as string}</span>
                    {" · "}
                    {(s.role_label as string).replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No active staff yet.</p>
            )}
            <PropertyWizardForm action={savePropertyStaffStep}>
              <input type="hidden" name="property_id" value={id} />
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role_label">Role</Label>
                  <select
                    id="role_label"
                    name="role_label"
                    defaultValue="front_desk"
                    className={selectClass}
                  >
                    {[
                      "front_desk",
                      "reservation",
                      "fnb",
                      "kitchen",
                      "housekeeping",
                      "spa",
                      "security",
                      "maintenance",
                      "manager",
                      "other",
                    ].map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff_phone">Phone</Label>
                  <Input id="staff_phone" name="phone" />
                </div>
              </div>
              <Button type="submit" variant="outline" className="h-11 w-full">
                Add staff member
              </Button>
            </PropertyWizardForm>
          </section>

          <section className="space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Travel agents (optional)
              </h3>
              <p className="text-xs text-muted-foreground">
                Approved partners for credit and agent rates. Skip if you only take
                direct / OTA bookings.
              </p>
            </div>
            {(agentsRes.data ?? []).length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(agentsRes.data ?? []).map((a) => (
                  <li key={a.id as string}>
                    <span className="text-foreground">
                      {a.company_name as string}
                    </span>
                    {" · "}
                    {a.market as string} · {a.status as string}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No approved agents yet.</p>
            )}
            <PropertyWizardForm action={savePropertyAgentStep}>
              <input type="hidden" name="property_id" value={id} />
              <div className="space-y-1.5">
                <Label htmlFor="company_name">Company</Label>
                <Input id="company_name" name="company_name" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="market">Market</Label>
                  <select
                    id="market"
                    name="market"
                    defaultValue="bhutan"
                    className={selectClass}
                  >
                    <option value="bhutan">Bhutan</option>
                    <option value="jaigaon">Jaigaon</option>
                    <option value="india">India</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_name">Contact name</Label>
                  <Input id="contact_name" name="contact_name" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input id="contact_phone" name="contact_phone" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input id="contact_email" name="contact_email" type="email" />
                </div>
              </div>
              <Button type="submit" variant="outline" className="h-11 w-full">
                Add agent
              </Button>
            </PropertyWizardForm>
          </section>

          <section className="space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Settlement bank
              </h3>
              <p className="text-xs text-muted-foreground">
                Shown on pay links and night-audit packs. Not required to finish,
                but recommended before taking token deposits.
              </p>
            </div>
            <PropertyWizardForm action={savePropertyBanksAndComplete}>
              <input type="hidden" name="property_id" value={id} />
              <div className="space-y-1.5">
                <Label htmlFor="bank_label">Account label</Label>
                <Input
                  id="bank_label"
                  name="bank_label"
                  defaultValue={property.bank_accounts[0]?.label ?? ""}
                  placeholder="BoB current"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank_name">Bank</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  defaultValue={property.bank_accounts[0]?.bank ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank_account">Account number</Label>
                <Input
                  id="bank_account"
                  name="bank_account"
                  defaultValue={property.bank_accounts[0]?.account ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank_hint_complete">Guest-facing hint</Label>
                <Textarea
                  id="bank_hint_complete"
                  name="bank_hint"
                  rows={2}
                  defaultValue={property.bank_accounts[0]?.hint ?? ""}
                  className={fieldClass}
                />
              </div>
              <Button type="submit" className="h-11 w-full">
                Finish setup
              </Button>
            </PropertyWizardForm>
          </section>

          {completed ? null : (
            <p className="text-center text-xs text-muted-foreground">
              Finish requires at least one room type, physical door, and rate
              cell. Menu catalog and CMS stay under their own desks.
            </p>
          )}
        </div>
      ) : null}

      {completed ? (
        <div className="border-t border-border pt-2">
          <PropertyWizardForm action={reopenPropertySetup}>
            <input type="hidden" name="property_id" value={id} />
            <input type="hidden" name="start_step" value={String(step)} />
            <Button type="submit" variant="ghost" className="h-10 w-full text-xs">
              Mark setup incomplete (show desk banner)
            </Button>
          </PropertyWizardForm>
        </div>
      ) : null}
      </div>
    </PropertySetupModalShell>
  );
}
