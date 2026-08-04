"use client";

import {
  updateDamageCatalogItem,
  updatePropertyPoliciesSettings,
  type CommercialSettingsState,
} from "@/app/actions/erp-settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: CommercialSettingsState = { ok: false };

export type PolicySettingsData = {
  free_cancel_days: number;
  late_cancel_forfeit_deposit: boolean;
  no_show_nights: number;
  mou_free_cancel: boolean;
  mou_waive_no_show: boolean;
  guest_summary: string | null;
  house_rules: string | null;
  dos: string | null;
  donts: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  quiet_hours: string | null;
  early_checkout_fee_btn: number | null;
  late_checkout_fee_btn: number | null;
};

export type DamageItemRow = {
  id: string;
  code: string;
  label: string;
  amount_btn: number | null;
  is_active: boolean;
};

export function SettingsPoliciesPanel({
  propertyId,
  policy,
  damageItems,
}: {
  propertyId: string;
  policy: PolicySettingsData;
  damageItems: DamageItemRow[];
}) {
  const [state, action, pending] = useActionState(
    updatePropertyPoliciesSettings,
    initial,
  );
  useActionToast(state, { successMessage: "Policies saved" });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 md:p-6">
        <div className="mb-5 space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Guest stay
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Policies &amp; Wi‑Fi
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Stay times, Wi‑Fi credentials, cancel rules, and guest pack copy.
            Edit anytime — MoU agents get free cancel when enabled below.
          </p>
          <p className="max-w-2xl text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              What this controls:{" "}
            </span>
            check-in board messaging, guest WhatsApp pack, and cancel / fee
            enforcement at the desk
          </p>
        </div>

        {state.error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={action}>
          <input type="hidden" name="property_id" value={propertyId} />

          <div className="space-y-8">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground">
                Stay times &amp; Wi‑Fi
              </legend>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="check_in_time">Check-in time</Label>
                  <Input
                    id="check_in_time"
                    name="check_in_time"
                    defaultValue={policy.check_in_time ?? ""}
                    placeholder="14:00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="check_out_time">Check-out time</Label>
                  <Input
                    id="check_out_time"
                    name="check_out_time"
                    defaultValue={policy.check_out_time ?? ""}
                    placeholder="11:00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quiet_hours">Quiet hours</Label>
                  <Input
                    id="quiet_hours"
                    name="quiet_hours"
                    defaultValue={policy.quiet_hours ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wifi_name">Wi‑Fi name</Label>
                  <Input
                    id="wifi_name"
                    name="wifi_name"
                    defaultValue={policy.wifi_name ?? ""}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="wifi_password">Wi‑Fi password</Label>
                  <Input
                    id="wifi_password"
                    name="wifi_password"
                    defaultValue={policy.wifi_password ?? ""}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 border-t pt-6">
              <legend className="text-sm font-semibold text-foreground">
                Cancel &amp; fees
              </legend>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="free_cancel_days">
                    Free cancel (direct, days before)
                  </Label>
                  <Input
                    id="free_cancel_days"
                    name="free_cancel_days"
                    type="number"
                    min={0}
                    defaultValue={policy.free_cancel_days}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="no_show_nights">No-show charge (nights)</Label>
                  <Input
                    id="no_show_nights"
                    name="no_show_nights"
                    type="number"
                    min={0}
                    defaultValue={policy.no_show_nights}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="early_checkout_fee_btn">
                    Early checkout fee (Nu)
                  </Label>
                  <Input
                    id="early_checkout_fee_btn"
                    name="early_checkout_fee_btn"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={policy.early_checkout_fee_btn ?? ""}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="late_checkout_fee_btn">
                    Late checkout fee (Nu)
                  </Label>
                  <Input
                    id="late_checkout_fee_btn"
                    name="late_checkout_fee_btn"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={policy.late_checkout_fee_btn ?? ""}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <PolicyToggle
                  id="late_cancel_forfeit_deposit"
                  name="late_cancel_forfeit_deposit"
                  label="Late cancel forfeits deposit"
                  defaultChecked={policy.late_cancel_forfeit_deposit}
                />
                <PolicyToggle
                  id="mou_free_cancel"
                  name="mou_free_cancel"
                  label="MoU agents — free cancel anytime"
                  defaultChecked={policy.mou_free_cancel}
                />
                <PolicyToggle
                  id="mou_waive_no_show"
                  name="mou_waive_no_show"
                  label="MoU agents — waive no-show fee"
                  defaultChecked={policy.mou_waive_no_show}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-4 border-t pt-6">
              <legend className="text-sm font-semibold text-foreground">
                Guest pack
              </legend>
              <div className="space-y-1.5">
                <Label htmlFor="guest_summary">Guest policy summary</Label>
                <Textarea
                  id="guest_summary"
                  name="guest_summary"
                  rows={3}
                  defaultValue={policy.guest_summary ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="house_rules">House rules</Label>
                <Textarea
                  id="house_rules"
                  name="house_rules"
                  rows={3}
                  defaultValue={policy.house_rules ?? ""}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dos">Do&apos;s</Label>
                  <Textarea
                    id="dos"
                    name="dos"
                    rows={4}
                    defaultValue={policy.dos ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="donts">Don&apos;ts</Label>
                  <Textarea
                    id="donts"
                    name="donts"
                    rows={4}
                    defaultValue={policy.donts ?? ""}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <Button type="submit" className="mt-6 h-11" disabled={pending}>
            {pending ? "Saving…" : "Save policies"}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5 md:p-6">
        <div className="mb-5 space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Damage
          </p>
          <h3 className="text-lg font-semibold text-foreground">
            Damage catalog
          </h3>
          <p className="text-sm text-muted-foreground">
            Nu placeholders for folio Post damage and guest pack. Blank =
            manager prices on the spot.
          </p>
        </div>
        <ul className="divide-y rounded-lg border">
          {damageItems.map((item) => (
            <DamageItemRowForm key={item.id} propertyId={propertyId} item={item} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PolicyToggle({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3">
      <Checkbox id={id} name={name} value="on" defaultChecked={defaultChecked} />
      <Label htmlFor={id} className="text-sm text-foreground">
        {label}
      </Label>
    </div>
  );
}

function DamageItemRowForm({
  propertyId,
  item,
}: {
  propertyId: string;
  item: DamageItemRow;
}) {
  const [state, action, pending] = useActionState(updateDamageCatalogItem, initial);

  return (
    <li className="p-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="item_id" value={item.id} />
        <div className="min-w-[12rem] flex-1">
          <p className="font-medium text-sm text-foreground">{item.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{item.code}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`amt_${item.id}`} className="text-xs">
            Nu
          </Label>
          <Input
            id={`amt_${item.id}`}
            name="amount_btn"
            className="h-9 w-24"
            placeholder="mgr"
            defaultValue={
              item.amount_btn == null ? "" : String(item.amount_btn)
            }
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Checkbox
            id={`active_${item.id}`}
            name="is_active"
            value="on"
            defaultChecked={item.is_active}
          />
          <Label htmlFor={`active_${item.id}`} className="text-xs">
            Active
          </Label>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save
        </Button>
        {state.ok ? (
          <span className="text-xs text-citrus">Saved</span>
        ) : state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {item.amount_btn != null ? formatBtn(item.amount_btn) : "Manager price"}
          </span>
        )}
      </form>
    </li>
  );
}
