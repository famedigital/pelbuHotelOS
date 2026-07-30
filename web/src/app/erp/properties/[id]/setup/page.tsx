import {
  savePropertyBanksAndComplete,
  savePropertyDepositRules,
  savePropertyIncomeStreams,
  savePropertyRoomsStep,
} from "@/app/actions/erp-properties";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const selectClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
  const [, , deposit, roomTypes, ttl] = await Promise.all([
    0,
    0,
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
    <div className="erp mx-auto w-full max-w-xl space-y-8 p-4 md:p-6">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Step {step} of 5
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {step === 2
            ? "Rooms & rates"
            : step === 3
              ? "Income streams"
              : step === 4
                ? "Holds & deposits"
                : "Banks & go live"}
        </h2>
        <nav className="flex flex-wrap gap-2 text-xs">
          {[2, 3, 4, 5].map((s) => (
            <a
              key={s}
              href={`/erp/properties/${id}/setup?step=${s}`}
              className={
                s === step
                  ? "font-medium text-foreground"
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
                <span className="font-medium text-foreground">
                  {r.code as string}
                </span>{" "}
                · {r.name as string} · {Number(r.unit_count ?? 0)} units
              </li>
            ))}
            {(roomTypes.data ?? []).length === 0 ? (
              <li>No room types yet — add one below.</li>
            ) : null}
          </ul>
          <PropertyWizardForm action={savePropertyRoomsStep}>
            <input type="hidden" name="property_id" value={id} />
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" required placeholder="deluxe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Deluxe Suite" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit_count">Units</Label>
              <Input
                id="unit_count"
                name="unit_count"
                type="number"
                min={1}
                defaultValue={1}
              />
            </div>
            <input type="hidden" name="inventory_kind" value="sellable_guest" />
            <Button type="submit" variant="outline" className="h-11 w-full">
              Add room type
            </Button>
          </PropertyWizardForm>
          <Button asChild className="h-11 w-full">
            <a href={`/erp/properties/${id}/setup?step=3`}>
              Continue to income streams
            </a>
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <PropertyWizardForm action={savePropertyIncomeStreams}>
          <input type="hidden" name="property_id" value={id} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
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
            Channel / OTA (configure maps later)
          </label>
          <Button type="submit" className="h-11 w-full">
            Save and continue
          </Button>
        </PropertyWizardForm>
      ) : null}

      {step === 4 ? (
        <PropertyWizardForm action={savePropertyDepositRules}>
          <input type="hidden" name="property_id" value={id} />
          <div className="space-y-1.5">
            <Label htmlFor="mode">Token mode</Label>
            <select
              id="mode"
              name="mode"
              defaultValue={deposit.data?.mode ?? "one_night"}
              className={selectClass}
            >
              <option value="one_night">One night (min floor)</option>
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percent of stay</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor_btn">Floor BTN</Label>
            <Input
              id="floor_btn"
              name="floor_btn"
              type="number"
              min={0}
              defaultValue={Number(deposit.data?.floor_btn ?? 2000)}
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
                deposit.data?.percent != null
                  ? Number(deposit.data.percent)
                  : ""
              }
            />
          </div>
          <p className="text-sm font-medium text-foreground">
            Web client TTL (hours)
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
                defaultValue={ttlMap[s] ?? (s === "peak" ? 12 : s === "lean" ? 48 : 168)}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="bank_hint">Bank hint on pay link</Label>
            <Textarea
              id="bank_hint"
              name="bank_hint"
              rows={2}
              defaultValue={deposit.data?.bank_hint ?? ""}
              className={fieldClass}
            />
          </div>
          <Button type="submit" className="h-11 w-full">
            Save and continue
          </Button>
        </PropertyWizardForm>
      ) : null}

      {step === 5 ? (
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
            <Label htmlFor="bank_hint">Guest-facing hint</Label>
            <Textarea
              id="bank_hint"
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
      ) : null}
    </div>
  );
}
