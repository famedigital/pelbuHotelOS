import { FinanceImportsSettings } from "@/components/erp/finance/FinanceImportsSettings";
import {
  issueHostDomainVerify,
  markHostDomainVerified,
  saveRoomTypeSettings,
  updatePropertyDocumentDesign,
  updatePropertyHosts,
  updatePropertyIdentity,
  updatePropertyTaxSettings,
  updateTenantBilling,
  updateTenantName,
} from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { SettingsCommercialPanel } from "@/components/erp/SettingsCommercialPanel";
import {
  SettingsPoliciesPanel,
  type PolicySettingsData,
} from "@/components/erp/SettingsPoliciesPanel";
import { FastBookInvoice, type FastBookInvoiceData } from "@/components/erp/FastBookInvoice";
import { FastBookVoucher, type FastBookVoucherData } from "@/components/erp/FastBookVoucher";
import { LogoUploadForm } from "@/components/erp/LogoUploadForm";
import {
  ROOMS_VIEW_COOKIE,
  RoomSettingsPanel,
  type RoomTypeOption,
  type RoomUnitRow,
  type RoomsView,
} from "@/components/erp/RoomSettingsPanel";
import {
  SettingsAmenityParsPanel,
  type AmenityParRow,
} from "@/components/erp/SettingsAmenityParsPanel";
import { SettingsDangerZonePanel } from "@/components/erp/SettingsDangerZonePanel";
import {
  SettingsCompliancePanel,
  type ComplianceCategoryRow,
  type ComplianceDocumentRow,
} from "@/components/erp/SettingsCompliancePanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadProperty } from "@/lib/property-context";
import { rateToPercent, type PropertyDocumentDesign } from "@/lib/property-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadTenantForProperty } from "@/lib/tenant/load";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";

export const metadata = {
  title: "Settings | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const demoInvoice: FastBookInvoiceData = {
  bookingId: "INV-DEMO-001",
  checkIn: "2026-08-12",
  checkOut: "2026-08-15",
  nights: 3,
  adults: 2,
  guestName: "Tshering Wangdi",
  agentLabel: "Direct guest",
  sourceLabel: "Owner",
  paymentLabel: "Cash",
  lines: [
    { name: "Deluxe room", code: "deluxe", qty: 1, kind: "sellable_guest" },
    { name: "Breakfast", code: "breakfast", qty: 2, kind: "service" },
  ],
};

const demoVoucher: FastBookVoucherData = {
  bookingId: "VCH-DEMO-001",
  checkIn: "2026-08-12",
  checkOut: "2026-08-15",
  nights: 3,
  guestName: "Pema Choden",
  guestPhone: "+975 17 11 22 33",
  agentLabel: "Pelbu friends rate",
  guideNumber: "GUIDE-2881",
  lines: [{ name: "Superior room", code: "sup", qty: 1 }],
};

export default async function ErpSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { tab } = await searchParams;
  const settingsTabs = new Set([
    "identity",
    "commercial",
    "policies",
    "tax",
    "documents",
    "rooms",
    "compliance",
    "finance-imports",
    "danger",
  ]);
  const defaultTab =
    tab && settingsTabs.has(tab) ? tab : "identity";

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const deskRole = await getDeskRole();
  const isOwner = deskRole === "owner";
  const [property, tenant, roomTypesResult, roomUnitsResult, mealPlansResult, policyResult, damageResult, amenityParsResult] = await Promise.all([
    loadProperty(admin, propertyId),
    loadTenantForProperty(admin, propertyId),
    admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", propertyId)
      .order("code"),
    admin
      .from("room_units")
      .select("id, room_type_id, label, floor_label, view_label, has_balcony, notes, hk_status, sort_order")
      .eq("property_id", propertyId)
      .order("sort_order")
      .order("label"),
    admin
      .from("meal_plans")
      .select("code, name, blurb, amount_btn_per_adult_night, is_active, sort_order")
      .eq("property_id", propertyId)
      .order("sort_order"),
    admin
      .from("property_policies")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("property_damage_items")
      .select("id, code, label, amount_btn, is_active, sort_order")
      .eq("property_id", propertyId)
      .order("sort_order"),
    admin
      .from("room_amenity_pars")
      .select(
        `id, par_qty, sort_order, is_active,
         inventory_items(sku, name, unit, qty_on_hand, reorder_level, unit_cost_btn)`,
      )
      .eq("property_id", propertyId)
      .order("sort_order"),
  ]);

  if (!property) notFound();

  const roomTypes = ((roomTypesResult.data ?? []) as RoomTypeOption[]).map(
    (type) => ({ ...type, unit_count: Number(type.unit_count ?? 0) }),
  );
  const roomUnits = ((roomUnitsResult.data ?? []) as RoomUnitRow[]).map(
    (unit) => ({
      ...unit,
      sort_order: Number(unit.sort_order ?? 0),
      has_balcony: Boolean(unit.has_balcony),
      view_label: unit.view_label ?? null,
    }),
  );
  const inventoryKindByType = new Map(
    roomTypes.map((type) => [type.id, type.inventory_kind]),
  );
  const roomInventoryTotals = roomUnits.reduce(
    (totals, unit) => {
      const kind = inventoryKindByType.get(unit.room_type_id);
      if (kind === "sellable_guest") totals.sellable += 1;
      if (kind === "guide_comp") totals.guide += 1;
      if (kind === "driver_comp") totals.driver += 1;
      return totals;
    },
    { sellable: 0, guide: 0, driver: 0 },
  );

  const amenityPars: AmenityParRow[] = (amenityParsResult.data ?? [])
    .map((row) => {
      const item = row.inventory_items as
        | {
            sku?: string;
            name?: string;
            unit?: string;
            qty_on_hand?: number;
            reorder_level?: number;
            unit_cost_btn?: number;
          }
        | {
            sku?: string;
            name?: string;
            unit?: string;
            qty_on_hand?: number;
            reorder_level?: number;
            unit_cost_btn?: number;
          }[]
        | null;
      const inv = Array.isArray(item) ? item[0] : item;
      if (!inv?.sku) return null;
      return {
        id: row.id as string,
        par_qty: Number(row.par_qty),
        sort_order: Number(row.sort_order),
        is_active: Boolean(row.is_active),
        sku: inv.sku,
        name: inv.name ?? inv.sku,
        unit: inv.unit ?? "ea",
        qty_on_hand: Number(inv.qty_on_hand ?? 0),
        reorder_level: Number(inv.reorder_level ?? 0),
        unit_cost_btn: Number(inv.unit_cost_btn ?? 0),
      };
    })
    .filter((row): row is AmenityParRow => row != null);

  const roomsView: RoomsView =
    (await cookies()).get(ROOMS_VIEW_COOKIE)?.value === "cards"
      ? "cards"
      : "table";

  const { data: defaultMealRow } = await admin
    .from("properties")
    .select("default_meal_plan_code")
    .eq("id", propertyId)
    .maybeSingle();

  const mealPlans = (mealPlansResult.data ?? []).map((row) => ({
    code: row.code as string,
    name: row.name as string,
    blurb: (row.blurb as string | null) ?? null,
    amount_btn_per_adult_night:
      row.amount_btn_per_adult_night == null
        ? null
        : Number(row.amount_btn_per_adult_night),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  }));

  const policy: PolicySettingsData = policyResult.data
    ? {
        free_cancel_days: Number(policyResult.data.free_cancel_days ?? 3),
        late_cancel_forfeit_deposit: Boolean(
          policyResult.data.late_cancel_forfeit_deposit,
        ),
        no_show_nights: Number(policyResult.data.no_show_nights ?? 1),
        mou_free_cancel: Boolean(policyResult.data.mou_free_cancel),
        mou_waive_no_show: Boolean(policyResult.data.mou_waive_no_show),
        guest_summary: (policyResult.data.guest_summary as string | null) ?? null,
        house_rules: (policyResult.data.house_rules as string | null) ?? null,
        dos: (policyResult.data.dos as string | null) ?? null,
        donts: (policyResult.data.donts as string | null) ?? null,
        wifi_name: (policyResult.data.wifi_name as string | null) ?? null,
        wifi_password: (policyResult.data.wifi_password as string | null) ?? null,
        check_in_time: (policyResult.data.check_in_time as string | null) ?? null,
        check_out_time: (policyResult.data.check_out_time as string | null) ?? null,
        quiet_hours: (policyResult.data.quiet_hours as string | null) ?? null,
        early_checkout_fee_btn:
          policyResult.data.early_checkout_fee_btn == null
            ? null
            : Number(policyResult.data.early_checkout_fee_btn),
        late_checkout_fee_btn:
          policyResult.data.late_checkout_fee_btn == null
            ? null
            : Number(policyResult.data.late_checkout_fee_btn),
      }
    : {
        free_cancel_days: 3,
        late_cancel_forfeit_deposit: true,
        no_show_nights: 1,
        mou_free_cancel: true,
        mou_waive_no_show: true,
        guest_summary: null,
        house_rules: null,
        dos: null,
        donts: null,
        wifi_name: null,
        wifi_password: null,
        check_in_time: null,
        check_out_time: null,
        quiet_hours: null,
        early_checkout_fee_btn: null,
        late_checkout_fee_btn: null,
      };

  const damageItems = (damageResult.data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    label: row.label as string,
    amount_btn: row.amount_btn == null ? null : Number(row.amount_btn),
    is_active: Boolean(row.is_active),
  }));

  const [{ data: complianceCategoriesRaw }, { data: complianceDocsRaw }] =
    await Promise.all([
      admin
        .from("property_compliance_categories")
        .select("id, code, name, description, sort_order")
        .eq("property_id", propertyId)
        .order("sort_order"),
      admin
        .from("property_compliance_documents")
        .select(
          `id, category_id, title, file_name, storage_path, uploaded_at, valid_until,
           lease_agreement_ref, deposit_slip_ref, handover_inventory_ref,
           property_compliance_categories(name, code)`,
        )
        .eq("property_id", propertyId)
        .order("uploaded_at", { ascending: false })
        .limit(100),
    ]);

  const docCountByCategory = new Map<string, number>();
  for (const doc of complianceDocsRaw ?? []) {
    const cid = doc.category_id as string;
    docCountByCategory.set(cid, (docCountByCategory.get(cid) ?? 0) + 1);
  }

  const complianceCategories: ComplianceCategoryRow[] = (
    complianceCategoriesRaw ?? []
  ).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    name: c.name as string,
    description: (c.description as string | null) ?? null,
    documentCount: docCountByCategory.get(c.id as string) ?? 0,
  }));

  const complianceDocuments: ComplianceDocumentRow[] = (
    complianceDocsRaw ?? []
  ).map((d) => {
    const cat = d.property_compliance_categories as {
      name?: string;
      code?: string;
    } | null;
    return {
      id: d.id as string,
      categoryId: d.category_id as string,
      categoryName: cat?.name ?? "Category",
      categoryCode: cat?.code ?? "other",
      title: d.title as string,
      fileName: d.file_name as string,
      storagePath: d.storage_path as string,
      uploadedAt: d.uploaded_at as string,
      validUntil: (d.valid_until as string | null) ?? null,
      leaseAgreementRef: (d.lease_agreement_ref as string | null) ?? null,
      depositSlipRef: (d.deposit_slip_ref as string | null) ?? null,
      handoverInventoryRef: (d.handover_inventory_ref as string | null) ?? null,
    };
  });

  return (
    <div className="erp space-y-8 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Admin"
        title="Settings"
        description="Edit the active hotel’s identity, tax defaults, document styling, and physical room setup."
        actions={
          <>
            <a
              href={`/erp/properties/${property.id}/setup`}
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
            >
              Setup wizard
            </a>
            <a
              href="/erp/rates"
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
            >
              Room rates
            </a>
          </>
        }
      />

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="commercial">Rates &amp; meals</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="tax">Tax & service</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="finance-imports">Finance imports</TabsTrigger>
          {isOwner ? (
            <TabsTrigger value="danger" className="text-destructive data-[state=active]:text-destructive">
              Danger zone
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="identity" className="space-y-6">
          <section className="rounded-xl border bg-card p-5 md:p-6">
            <div className="mb-5 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Logo
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Hotel logo
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Pick the logo used on the desk header and printed documents
                straight from the Cloudinary media gallery, or upload a new one.
              </p>
            </div>

            <LogoUploadForm
              propertyId={property.id}
              currentLogoPublicId={property.logo_public_id}
            />
          </section>

          <section className="rounded-xl border bg-card p-5 md:p-6">
            <div className="mb-5 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Identity
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Hotel brand and legal details
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                These details power the ERP header and document printouts. Use a
                Cloudinary public ID for the current hotel logo.
              </p>
            </div>

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

            <div className="mt-8 border-t pt-6">
              <div className="mb-4 space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                  White-label hosts
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Public & desk hostnames
                </h3>
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
              <div className="mt-8 border-t pt-6">
                <div className="mb-4 space-y-1">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                    Platform tenant
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Org name & seats
                  </h3>
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
          </section>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-6">
          <SettingsCommercialPanel
            propertyId={property.id}
            defaultMealPlanCode={
              (defaultMealRow?.default_meal_plan_code as string | undefined) ?? "EP"
            }
            mealPlans={mealPlans}
          />
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <SettingsPoliciesPanel
            propertyId={property.id}
            policy={policy}
            damageItems={damageItems}
          />
        </TabsContent>

        <TabsContent value="tax" className="space-y-6">
          <section className="rounded-xl border bg-card p-5 md:p-6">
            <div className="mb-5 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Tax and billing
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                GST and service charge defaults
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Staff can still switch service charge off per bill for friends,
                house use, and one-off exceptions.
              </p>
            </div>

            <PropertyWizardForm action={updatePropertyTaxSettings}>
              <input type="hidden" name="property_id" value={property.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gst_rate">GST rate (%)</Label>
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
                  Post day-1 room rent at check-in (rates from room rates sheet;
                  later nights still at night audit)
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="night_audit_close_time">
                  Night audit close time (local)
                </Label>
                <Input
                  id="night_audit_close_time"
                  name="night_audit_close_time"
                  type="time"
                  defaultValue={property.night_audit_close_time ?? "00:00"}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Cron skips this property until local wall-clock reaches this
                  time ({property.timezone}). Default 00:00 = midnight.
                </p>
              </div>
              <Button type="submit" className="h-11">
                Save tax &amp; night-audit defaults
              </Button>
            </PropertyWizardForm>
          </section>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <DocumentSection
            propertyId={property.id}
            title="Invoice"
            docKind="invoice"
            design={property.doc_invoice}
          />
          <div className="rounded-xl border bg-card p-5 md:p-6">
            <FastBookInvoice
              data={demoInvoice}
              property={{
                name: property.name,
                legal_name: property.legal_name,
                address: property.address,
                phone: property.phone,
                email: property.email,
                tax_id: property.tax_id,
                logo_public_id: property.logo_public_id,
              }}
              design={property.doc_invoice}
            />
          </div>

          <DocumentSection
            propertyId={property.id}
            title="Receipt"
            docKind="receipt"
            design={property.doc_receipt}
          />
          <div className="rounded-xl border bg-card p-5 md:p-6">
            <ReceiptPreview
              property={property}
              design={property.doc_receipt}
              bookingId="RCT-DEMO-004"
              guestName="Sonam Lhamo"
              postedAt="29 Jul 2026, 15:40"
              subtotal="Nu 2,100"
              serviceCharge="Nu 210"
              gst="Nu 162.7"
              total="Nu 2,472.7"
            />
          </div>

          <DocumentSection
            propertyId={property.id}
            title="Voucher"
            docKind="voucher"
            design={property.doc_voucher}
          />
          <div className="rounded-xl border bg-card p-5 md:p-6">
            <FastBookVoucher
              data={demoVoucher}
              property={{
                name: property.name,
                legal_name: property.legal_name,
                address: property.address,
                phone: property.phone,
                email: property.email,
                tax_id: property.tax_id,
                logo_public_id: property.logo_public_id,
              }}
              design={property.doc_voucher}
            />
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-6">
          <section aria-label="Room inventory totals">
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total sellable rooms",
                  value: roomInventoryTotals.sellable,
                  note: "Guest inventory",
                },
                {
                  label: "Total guide beds",
                  value: roomInventoryTotals.guide,
                  note: "Complimentary inventory",
                },
                {
                  label: "Total driver beds",
                  value: roomInventoryTotals.driver,
                  note: "Complimentary inventory",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border bg-card px-5 py-4"
                >
                  <dt className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                    {item.value}
                  </dd>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.note}
                  </p>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-5 md:p-6">
            <div className="mb-5 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                New category
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Add a room category
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                The count auto-creates physical rooms. Rename them to the exact
                room numbers you use on property in the tables below.
              </p>
            </div>

            <PropertyWizardForm action={saveRoomTypeSettings}>
              <input type="hidden" name="property_id" value={property.id} />
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" name="code" placeholder="deluxe" required />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="room_name">Room category</Label>
                  <Input id="room_name" name="name" placeholder="Deluxe room" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit_count">No. of rooms</Label>
                  <Input
                    id="unit_count"
                    name="unit_count"
                    type="number"
                    min={0}
                    max={500}
                    step="1"
                    defaultValue={1}
                    required
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="inventory_kind">Inventory kind</Label>
                  <select id="inventory_kind" name="inventory_kind" className={fieldClass}>
                    <option value="sellable_guest">Sellable guest</option>
                    <option value="guide_comp">Guide complimentary</option>
                    <option value="driver_comp">Driver complimentary</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="h-11">
                Add room category
              </Button>
            </PropertyWizardForm>
          </section>

          <SettingsAmenityParsPanel rows={amenityPars} />

          <RoomSettingsPanel
            propertyId={property.id}
            roomTypes={roomTypes}
            units={roomUnits}
            initialView={roomsView}
          />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <SettingsCompliancePanel
            categories={complianceCategories}
            documents={complianceDocuments}
          />
        </TabsContent>

        <TabsContent value="finance-imports" className="space-y-6">
          <section className="rounded-xl border bg-card p-5 md:p-6">
            <div className="mb-5 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                Finance imports
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Receipt and bank statement parsers
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Upload, test, approve, and version Python parsers. Approved
                versions run only in the isolated finance-parser-worker — never
                inside Next.js. Gemini keys stay in server/worker environment
                variables.
              </p>
            </div>
            <FinanceImportsSettings />
          </section>
        </TabsContent>

        {isOwner ? (
          <TabsContent value="danger" className="space-y-6">
            <SettingsDangerZonePanel propertyId={property.id} confirmPhrase="WIPE" />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function DocumentSection({
  propertyId,
  title,
  docKind,
  design,
}: {
  propertyId: string;
  title: string;
  docKind: "invoice" | "receipt" | "voucher";
  design: PropertyDocumentDesign;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          {title}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title} design
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose a preset, then tweak colors, header/footer, visible fields, and
          paper size without breaking print reliability.
        </p>
      </div>

      <PropertyWizardForm action={updatePropertyDocumentDesign}>
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="doc_kind" value={docKind} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-preset`}>Preset</Label>
            <select
              id={`${docKind}-preset`}
              name="preset"
              defaultValue={design.preset}
              className={fieldClass}
            >
              <option value="classic">Classic</option>
              <option value="compact">Compact</option>
              <option value="branded">Branded</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-paper`}>Paper size</Label>
            <select
              id={`${docKind}-paper`}
              name="paper_size"
              defaultValue={design.paper_size}
              className={fieldClass}
            >
              <option value="a4">A4</option>
              <option value="thermal">Thermal / narrow</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-brand`}>Brand color</Label>
            <Input id={`${docKind}-brand`} name="brand_color" defaultValue={design.brand_color} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-accent`}>Accent color</Label>
            <Input
              id={`${docKind}-accent`}
              name="accent_color"
              defaultValue={design.accent_color}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-header`}>Header text</Label>
            <Input
              id={`${docKind}-header`}
              name="header_text"
              defaultValue={design.header_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-footer`}>Footer text</Label>
            <Textarea
              id={`${docKind}-footer`}
              name="footer_text"
              rows={2}
              defaultValue={design.footer_text}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FieldToggle
            id={`${docKind}-show-phone`}
            name="show_phone"
            label="Show phone"
            defaultChecked={design.show_phone}
          />
          <FieldToggle
            id={`${docKind}-show-email`}
            name="show_email"
            label="Show email"
            defaultChecked={design.show_email}
          />
          <FieldToggle
            id={`${docKind}-show-tax`}
            name="show_tax_id"
            label="Show GST / tax ID"
            defaultChecked={design.show_tax_id}
          />
          <FieldToggle
            id={`${docKind}-show-address`}
            name="show_address"
            label="Show address"
            defaultChecked={design.show_address}
          />
        </div>
        <Button type="submit" className="h-11">
          Save {title.toLowerCase()} design
        </Button>
      </PropertyWizardForm>
    </section>
  );
}

function FieldToggle({
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
      <Checkbox id={id} name={name} value="1" defaultChecked={defaultChecked} />
      <Label htmlFor={id} className="text-sm text-foreground">
        {label}
      </Label>
    </div>
  );
}

function ReceiptPreview({
  property,
  design,
  bookingId,
  guestName,
  postedAt,
  subtotal,
  serviceCharge,
  gst,
  total,
}: {
  property: {
    name: string;
    legal_name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_id: string | null;
  };
  design: PropertyDocumentDesign;
  bookingId: string;
  guestName: string;
  postedAt: string;
  subtotal: string;
  serviceCharge: string;
  gst: string;
  total: string;
}) {
  return (
    <section
      className="rounded-lg border px-5 py-5"
      style={
        {
          borderColor: design.accent_color,
          background:
            design.preset === "branded"
              ? `linear-gradient(180deg, ${design.accent_color}12, transparent 28%)`
              : undefined,
        } as CSSProperties
      }
    >
      <div
        className="border-b pb-3"
        style={{ borderColor: design.brand_color }}
      >
        <p
          className="text-[11px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: design.brand_color }}
        >
          {property.name}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-foreground">Receipt preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">{design.header_text}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <PreviewField label="Guest" value={guestName} />
        <PreviewField label="Ref" value={bookingId} />
        <PreviewField label="Posted" value={postedAt} />
        <PreviewField label="Paper" value={design.paper_size} />
      </dl>
      <div className="mt-4 space-y-2 rounded-lg border px-4 py-4 text-sm">
        <PreviewMoney label="Subtotal" value={subtotal} />
        <PreviewMoney label="Service charge" value={serviceCharge} />
        <PreviewMoney label="GST" value={gst} />
        <div className="flex justify-between border-t pt-2 font-medium text-foreground">
          <span>Total</span>
          <span>{total}</span>
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        {design.show_address && property.address ? <p>{property.address}</p> : null}
        {design.show_phone && property.phone ? <p>{property.phone}</p> : null}
        {design.show_email && property.email ? <p>{property.email}</p> : null}
        {design.show_tax_id && property.tax_id ? <p>GST/TAX: {property.tax_id}</p> : null}
        <p className="mt-2">{design.footer_text}</p>
      </div>
    </section>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function PreviewMoney({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
