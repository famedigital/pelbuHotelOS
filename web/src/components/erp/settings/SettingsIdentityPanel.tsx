import {
  issueHostDomainVerify,
  markHostDomainVerified,
  updatePropertyHosts,
  updatePropertyIdentity,
  updateTenantBilling,
  updateTenantName,
} from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { LogoUploadForm } from "@/components/erp/LogoUploadForm";
import { LogoNavLayoutForm } from "@/components/erp/settings/LogoNavLayoutForm";
import { SettingsDeskSecurityPanel } from "@/components/erp/settings/SettingsDeskSecurityPanel";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PropertyRow } from "@/lib/property-types";
import type { TenantRow } from "@/lib/tenant/load";

export function SettingsIdentityPanel({
  property,
  tenant,
  deskRestrictToScheduledShifts = false,
  canEditDeskSecurity = false,
}: {
  property: PropertyRow;
  tenant: TenantRow | null;
  deskRestrictToScheduledShifts?: boolean;
  canEditDeskSecurity?: boolean;
}) {
  return (
    <div className="space-y-6">
      <SettingsDeskSecurityPanel
        propertyId={property.id}
        deskRestrictToScheduledShifts={deskRestrictToScheduledShifts}
        canEdit={canEditDeskSecurity}
      />

      <SettingsSection
        eyebrow="Logo"
        title="Hotel logo"
        description="Used on the public site header, desk header, and printed documents. Pick from the media gallery or upload a new one."
        blastRadius="guest-facing brand mark on the website, invoices, receipts, and the ERP header"
        status={property.logo_public_id ? "ready" : "attention"}
      >
        <LogoUploadForm
          propertyId={property.id}
          currentLogoPublicId={property.logo_public_id}
        />
      </SettingsSection>

      <SettingsSection
        eyebrow="Public header"
        title="Logo size & position"
        description="Tune mark size, vertical hang, horizontal shift, and space between the logo and hotel name."
        blastRadius="public site header and footer brand lockup only"
        status="ready"
      >
        <LogoNavLayoutForm
          propertyId={property.id}
          logoPublicId={property.logo_public_id}
          sizeRem={property.logo_nav_size_rem}
          offsetPct={property.logo_nav_offset_pct}
          gapRem={property.logo_nav_gap_rem}
          shiftXRem={property.logo_nav_shift_x_rem}
        />
      </SettingsSection>

      <SettingsSection
        eyebrow="Identity"
        title="Hotel brand and legal details"
        description="How guests and invoices know you — name, address, phone, WhatsApp, and tax ID."
        blastRadius="ERP header text, public site contact links, and document printouts"
      >
        <PropertyWizardForm action={updatePropertyIdentity}>
          <input type="hidden" name="property_id" value={property.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Property name</Label>
              <Input id="name" name="name" defaultValue={property.name} required />
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
              <Label htmlFor="product_pack">Product pack</Label>
              <select
                id="product_pack"
                name="product_pack"
                defaultValue={property.product_pack ?? "hotel"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="hotel">Hotel (full PMS + F&B)</option>
                <option value="restaurant">Restaurant only (hide rooms / channel)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Restaurant pack keeps POS, kitchen, inventory, finance, and HR.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos_training_mode">POS training mode</Label>
              <select
                id="pos_training_mode"
                name="pos_training_mode"
                defaultValue={property.pos_training_mode ? "1" : "0"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="0">Live (real sales)</option>
                <option value="1">Training drills (flag only — still audit carefully)</option>
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="logo_public_id">Logo public ID</Label>
              <Input
                id="logo_public_id"
                name="logo_public_id"
                defaultValue={property.logo_public_id ?? ""}
                placeholder="pelbu/brand/logo-primary"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                rows={3}
                defaultValue={property.address ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={property.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                defaultValue={property.whatsapp ?? property.phone ?? ""}
                placeholder="+975…"
              />
              <p className="text-xs text-muted-foreground">
                Public site chat link. Uses digits for wa.me — country code
                required. Leave matching phone if guests use the same number.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={property.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax_id">GST / tax ID</Label>
              <Input id="tax_id" name="tax_id" defaultValue={property.tax_id ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={property.timezone} disabled />
            </div>
          </div>
          <Button type="submit" className="h-11">
            Save identity
          </Button>
        </PropertyWizardForm>

        <details className="mt-8 border-t pt-6 group">
          <summary className="cursor-pointer list-none select-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                  Advanced
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Domain &amp; billing
                </h3>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  White-label hosts, cert tokens, and platform seats — technical
                  owner controls. Front desk staff can ignore this section.
                </p>
              </div>
              <span className="text-xs font-medium text-accent group-open:hidden">
                Show →
              </span>
              <span className="hidden text-xs font-medium text-accent group-open:inline">
                Hide
              </span>
            </div>
          </summary>

          <div className="mt-6 space-y-8">
            <div>
              <div className="mb-4 space-y-1">
                <h4 className="text-base font-semibold text-foreground">
                  Public &amp; desk hostnames
                </h4>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Middleware maps these Host headers to this property. Add the
                  same hostnames in Vercel domains. Leave blank to use the
                  flagship slug fallback.
                </p>
              </div>
              <PropertyWizardForm action={updatePropertyHosts}>
                <input type="hidden" name="property_id" value={property.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="public_host">Public host</Label>
                    <Input
                      id="public_host"
                      name="public_host"
                      defaultValue={property.public_host ?? ""}
                      placeholder="www.example.bt"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desk_host">Desk host</Label>
                    <Input
                      id="desk_host"
                      name="desk_host"
                      defaultValue={property.desk_host ?? ""}
                      placeholder="desk.example.bt"
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" className="mt-4 h-11">
                  Save hostnames
                </Button>
              </PropertyWizardForm>
              <div className="mt-4 grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Public cert
                  </p>
                  <p className="mt-1 capitalize">
                    {property.public_host_cert_status ?? "none"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Desk cert
                  </p>
                  <p className="mt-1 capitalize">
                    {property.desk_host_cert_status ?? "none"}
                  </p>
                </div>
                {property.host_verify_token ? (
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      DNS TXT token
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {property.host_verify_token}
                    </p>
                  </div>
                ) : null}
                <PropertyWizardForm action={issueHostDomainVerify}>
                  <input type="hidden" name="property_id" value={property.id} />
                  <input type="hidden" name="host_target" value="public" />
                  <Button type="submit" variant="outline" size="sm" className="h-9">
                    Issue public verify token
                  </Button>
                </PropertyWizardForm>
                <PropertyWizardForm action={markHostDomainVerified}>
                  <input type="hidden" name="property_id" value={property.id} />
                  <input type="hidden" name="host_target" value="public" />
                  <Button type="submit" variant="outline" size="sm" className="h-9">
                    Mark public cert verified
                  </Button>
                </PropertyWizardForm>
              </div>
            </div>

            {tenant ? (
              <div className="border-t pt-6">
                <div className="mb-4 space-y-1">
                  <h4 className="text-base font-semibold text-foreground">
                    Org name &amp; seats
                  </h4>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    SaaS org for this hotel. Plan and seat limit are
                    invoice-first stubs — no card billing yet. Staff access is
                    per-property Auth; do not share one DESK_PIN across hotels.
                  </p>
                </div>
                <PropertyWizardForm action={updateTenantName}>
                  <input type="hidden" name="property_id" value={property.id} />
                  <input type="hidden" name="tenant_id" value={tenant.id} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="tenant_name">Tenant name</Label>
                      <Input
                        id="tenant_name"
                        name="tenant_name"
                        defaultValue={tenant.name}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tenant_plan">Plan</Label>
                      <Input
                        id="tenant_plan"
                        value={tenant.plan}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tenant_seats">Seat limit</Label>
                      <Input
                        id="tenant_seats"
                        value={String(tenant.seat_limit)}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tenant_billing">Billing status</Label>
                      <Input
                        id="tenant_billing"
                        value={tenant.billing_status.replace(/_/g, " ")}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tenant_slug">Slug</Label>
                      <Input
                        id="tenant_slug"
                        value={tenant.slug}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                  {tenant.billing_notes ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {tenant.billing_notes}
                    </p>
                  ) : null}
                  <Button type="submit" variant="outline" className="mt-4 h-11">
                    Save tenant name
                  </Button>
                </PropertyWizardForm>
                <div className="mt-6 border-t pt-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    Billing &amp; seats
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Invoice-first contact and soft seat usage vs limit. Stripe
                    self-serve remains future.
                  </p>
                  <PropertyWizardForm action={updateTenantBilling}>
                    <input type="hidden" name="property_id" value={property.id} />
                    <input type="hidden" name="tenant_id" value={tenant.id} />
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="billing_email">Billing email</Label>
                        <Input
                          id="billing_email"
                          name="billing_email"
                          type="email"
                          defaultValue={tenant.billing_email ?? ""}
                          placeholder="accounts@hotel.bt"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="seats_used">
                          Seats used (of {tenant.seat_limit})
                        </Label>
                        <Input
                          id="seats_used"
                          name="seats_used"
                          type="number"
                          min={0}
                          max={tenant.seat_limit}
                          defaultValue={String(tenant.seats_used)}
                        />
                      </div>
                    </div>
                    {tenant.domain_verified_at ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Domain verified{" "}
                        {new Date(tenant.domain_verified_at).toLocaleString(
                          "en-BT",
                        )}
                      </p>
                    ) : null}
                    <Button type="submit" variant="outline" className="mt-4 h-11">
                      Save billing &amp; seats
                    </Button>
                  </PropertyWizardForm>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </SettingsSection>
    </div>
  );
}
