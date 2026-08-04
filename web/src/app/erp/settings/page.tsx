import { saveRoomTypeSettings } from "@/app/actions/erp-settings";
import { FinanceImportsSettings } from "@/components/erp/finance/FinanceImportsSettings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { SettingsCommercialPanel } from "@/components/erp/SettingsCommercialPanel";
import {
  SettingsPoliciesPanel,
  type PolicySettingsData,
} from "@/components/erp/SettingsPoliciesPanel";
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
import { SettingsDocumentsPanel } from "@/components/erp/settings/SettingsDocumentsPanel";
import { SettingsHub } from "@/components/erp/settings/SettingsHub";
import { SettingsIdentityPanel } from "@/components/erp/settings/SettingsIdentityPanel";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { SettingsShell } from "@/components/erp/settings/SettingsShell";
import { SettingsTaxPanel } from "@/components/erp/settings/SettingsTaxPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  buildSettingsReadiness,
  type SettingsTabKey,
} from "@/lib/erp/settings-readiness";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadTenantForProperty } from "@/lib/tenant/load";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Settings | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const SETTINGS_TABS = new Set<string>([
  "overview",
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

export default async function ErpSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { tab } = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const deskRole = await getDeskRole();
  const isOwner = deskRole === "owner";

  let activeTab: SettingsTabKey =
    tab && SETTINGS_TABS.has(tab) ? (tab as SettingsTabKey) : "overview";
  if (activeTab === "danger" && !isOwner) {
    activeTab = "overview";
  }

  const [
    property,
    tenant,
    roomTypesResult,
    roomUnitsResult,
    mealPlansResult,
    policyResult,
    damageResult,
    amenityParsResult,
  ] = await Promise.all([
    loadProperty(admin, propertyId),
    loadTenantForProperty(admin, propertyId),
    admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", propertyId)
      .order("code"),
    admin
      .from("room_units")
      .select(
        "id, room_type_id, label, floor_label, view_label, has_balcony, notes, hk_status, sort_order",
      )
      .eq("property_id", propertyId)
      .order("sort_order")
      .order("label"),
    admin
      .from("meal_plans")
      .select(
        "code, name, blurb, amount_btn_per_adult_night, amount_btn_per_child_night, is_active, sort_order",
      )
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
    amount_btn_per_child_night:
      row.amount_btn_per_child_night == null
        ? null
        : Number(row.amount_btn_per_child_night),
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
        check_out_time:
          (policyResult.data.check_out_time as string | null) ?? null,
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

  const readiness = buildSettingsReadiness({
    setup_completed_at: property.setup_completed_at,
    logo_public_id: property.logo_public_id,
    address: property.address,
    phone: property.phone,
    tax_id: property.tax_id,
    gst_rate: property.gst_rate,
    sellableRooms: roomInventoryTotals.sellable,
    check_in_time: policy.check_in_time,
    wifi_name: policy.wifi_name,
  });

  return (
    <SettingsShell
      activeTab={activeTab}
      isOwner={isOwner}
      setupComplete={Boolean(property.setup_completed_at)}
      actions={
        <>
          <a
            href={`/erp/properties/${property.id}/setup`}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
          >
            Setup wizard
          </a>
          {!property.setup_completed_at ? (
            <span className="inline-flex h-10 items-center rounded-md border border-amber-500/35 bg-amber-500/[0.06] px-3 text-xs font-medium text-amber-900 dark:text-amber-200">
              Incomplete
            </span>
          ) : null}
          <a
            href="/erp/rates"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
          >
            Room rates
          </a>
        </>
      }
    >
      {activeTab === "overview" ? (
        <SettingsHub
          propertyId={property.id}
          readiness={readiness}
          isOwner={isOwner}
        />
      ) : null}

      {activeTab === "identity" ? (
        <SettingsIdentityPanel
          property={property}
          tenant={tenant}
          deskRestrictToScheduledShifts={Boolean(
            (
              policyResult.data as
                | { desk_restrict_to_scheduled_shifts?: boolean }
                | null
                | undefined
            )?.desk_restrict_to_scheduled_shifts,
          )}
          canEditDeskSecurity={deskRole === "owner" || deskRole === "gm"}
        />
      ) : null}

      {activeTab === "commercial" ? (
        <SettingsCommercialPanel
          propertyId={property.id}
          defaultMealPlanCode={
            (defaultMealRow?.default_meal_plan_code as string | undefined) ??
            "EP"
          }
          mealPlans={mealPlans}
          extraBedRateBtn={
            policyResult.data?.extra_bed_rate_btn == null
              ? null
              : Number(policyResult.data.extra_bed_rate_btn)
          }
          extraBedActive={Boolean(policyResult.data?.extra_bed_active)}
          staffSalesCommissionPct={
            policyResult.data?.staff_sales_commission_pct == null
              ? null
              : Number(policyResult.data.staff_sales_commission_pct)
          }
          ratesInclusiveOfGstSc={Boolean(
            (
              policyResult.data as
                | { rates_inclusive_of_gst_sc?: boolean }
                | null
                | undefined
            )?.rates_inclusive_of_gst_sc,
          )}
        />
      ) : null}

      {activeTab === "policies" ? (
        <SettingsPoliciesPanel
          propertyId={property.id}
          policy={policy}
          damageItems={damageItems}
        />
      ) : null}

      {activeTab === "tax" ? <SettingsTaxPanel property={property} /> : null}

      {activeTab === "documents" ? (
        <SettingsDocumentsPanel property={property} />
      ) : null}

      {activeTab === "rooms" ? (
        <div className="space-y-6">
          <SettingsSection
            eyebrow="Rooms"
            title="Room inventory"
            description="Categories, door numbers, and amenity stock levels for this hotel."
            blastRadius="physical sellable rooms on the calendar, rates sheet, and channel inventory"
            status={
              roomInventoryTotals.sellable > 0 ? "ready" : "attention"
            }
          >
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
                  className="rounded-lg border bg-background px-4 py-3"
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
          </SettingsSection>

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
                  <Input
                    id="room_name"
                    name="name"
                    placeholder="Deluxe room"
                    required
                  />
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
                  <select
                    id="inventory_kind"
                    name="inventory_kind"
                    className={fieldClass}
                  >
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
        </div>
      ) : null}

      {activeTab === "compliance" ? (
        <SettingsCompliancePanel
          categories={complianceCategories}
          documents={complianceDocuments}
        />
      ) : null}

      {activeTab === "finance-imports" ? (
        <SettingsSection
          eyebrow="Advanced"
          title="Receipt and bank statement parsers"
          description="Upload, test, approve, and version Python parsers. Approved versions run only in the isolated finance-parser-worker — never inside Next.js."
          blastRadius="bank proof parsing and expense receipt extraction — Gemini keys stay in server env"
        >
          <FinanceImportsSettings />
        </SettingsSection>
      ) : null}

      {activeTab === "danger" && isOwner ? (
        <SettingsDangerZonePanel
          propertyId={property.id}
          confirmPhrase="WIPE"
        />
      ) : null}
    </SettingsShell>
  );
}
