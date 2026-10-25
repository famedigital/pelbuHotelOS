import { updatePropertyTaxSettings } from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rateToPercent } from "@/lib/property-settings";
import type { PropertyRow } from "@/lib/property-types";

export function SettingsTaxPanel({ property }: { property: PropertyRow }) {
  return (
    <SettingsSection
      eyebrow="Tax and billing"
      title="GST and service charge defaults"
      description="GST is one switch for this hotel: rooms, menu, and services. Service charge is separate and can still be turned off per bill."
      blastRadius="every new folio, POS service bill, and end-of-day room-night post"
    >
      <PropertyWizardForm action={updatePropertyTaxSettings}>
        <input type="hidden" name="property_id" value={property.id} />
        <div className="flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3">
          <Checkbox
            id="gst_enabled"
            name="gst_enabled"
            value="1"
            defaultChecked={property.gst_enabled !== false}
          />
          <div className="space-y-0.5">
            <Label htmlFor="gst_enabled" className="text-sm text-foreground">
              Charge GST
            </Label>
            <p className="text-xs text-muted-foreground">
              Off until this hotel is GST-registered. Rooms, meals, menu, and
              services then post no GST. When this is on, the rate below is
              added on the charge plus service charge, everywhere.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gst_rate">GST rate (%) when GST is on</Label>
            <Input
              id="gst_rate"
              name="gst_rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={rateToPercent(property.gst_rate)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service_charge_rate">Service charge (%)</Label>
            <Input
              id="service_charge_rate"
              name="service_charge_rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={rateToPercent(property.service_charge_rate)}
              required
            />
          </div>
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3">
          <Checkbox
            id="service_charge_default_on"
            name="service_charge_default_on"
            value="1"
            defaultChecked={property.service_charge_default_on}
          />
          <Label
            htmlFor="service_charge_default_on"
            className="text-sm text-foreground"
          >
            Apply service charge by default on new POS and folio service bills
          </Label>
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3">
          <Checkbox
            id="post_day1_room_at_checkin"
            name="post_day1_room_at_checkin"
            value="1"
            defaultChecked={property.post_day1_room_at_checkin !== false}
          />
          <Label
            htmlFor="post_day1_room_at_checkin"
            className="text-sm text-foreground"
          >
            Post day-1 room rent at check-in (rates from room rates sheet; later
            nights still at end-of-day close)
          </Label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="night_audit_close_time">
            End-of-day close time (local)
          </Label>
          <Input
            id="night_audit_close_time"
            name="night_audit_close_time"
            type="time"
            defaultValue={property.night_audit_close_time ?? "00:00"}
            required
          />
          <p className="text-xs text-muted-foreground">
            Night audit cron skips this property until local wall-clock reaches
            this time ({property.timezone}). Default 00:00 = midnight.
          </p>
        </div>
        <Button type="submit" className="h-11">
          Save tax &amp; close-time defaults
        </Button>
      </PropertyWizardForm>
    </SettingsSection>
  );
}
