"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  ACTIVE_PROPERTY_COOKIE,
  DEFAULT_INCOME_STREAMS,
  slugifyHotelName,
  type IncomeStreams,
} from "@/lib/property-context";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type PropertyWizardState = {
  ok: boolean;
  propertyId?: string;
  error?: string;
  message?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

const DEFAULT_TTL: [string, string, number][] = [
  ["client", "peak", 12],
  ["client", "lean", 48],
  ["client", "off", 168],
  ["agent", "peak", 24],
  ["agent", "lean", 72],
  ["agent", "off", 240],
  ["reservation", "peak", 6],
  ["reservation", "lean", 24],
  ["reservation", "off", 72],
  ["owner", "peak", 6],
  ["owner", "lean", 24],
  ["owner", "off", 72],
  ["ota", "peak", 24],
  ["ota", "lean", 48],
  ["ota", "off", 72],
];

async function seedHoldRules(propertyId: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("hold_ttl_rules").upsert(
    DEFAULT_TTL.map(([source, season_kind, ttl_hours]) => ({
      property_id: propertyId,
      source,
      season_kind,
      ttl_hours,
    })),
    { onConflict: "property_id,source,season_kind" },
  );
  await admin.from("property_deposit_rules").upsert({
    property_id: propertyId,
    mode: "one_night",
    floor_btn: 2000,
    percent: null,
    bank_hint: "Transfer token · quote booking ID in remarks",
  });
}

/** Step 1 — create property identity */
export async function createPropertyIdentity(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const name = trimRequired(formData.get("name"), "Hotel name");
    const slugRaw =
      optionalTrim(formData.get("slug")) ?? slugifyHotelName(name);
    const slug = slugifyHotelName(slugRaw);
    if (!slug) throw new Error("Slug is required.");
    const timezone =
      optionalTrim(formData.get("timezone")) ?? "Asia/Thimphu";
    const cloneFrom = optionalTrim(formData.get("clone_from")) === "flagship";
    const templateId = Number(formData.get("template_id") ?? 1) || 1;

    const { data: existing } = await admin
      .from("properties")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) throw new Error("That slug is already used.");

    const { data: property, error } = await admin
      .from("properties")
      .insert({
        name,
        slug,
        timezone,
        template_id: templateId,
        setup_step: 2,
        income_streams: DEFAULT_INCOME_STREAMS,
        bank_accounts: [],
      })
      .select("id")
      .single();
    if (error || !property) {
      console.error("createPropertyIdentity", error);
      throw new Error("Could not create property.");
    }

    await seedHoldRules(property.id as string);

    if (cloneFrom) {
      const { data: flagship } = await admin
        .from("properties")
        .select("id")
        .eq("slug", PELBU_PROPERTY_SLUG)
        .maybeSingle();
      if (flagship) {
        await cloneRoomsAndSeasons(admin, flagship.id as string, property.id as string);
      }
    }

    const jar = await cookies();
    jar.set(ACTIVE_PROPERTY_COOKIE, property.id as string, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    await writeAuditEvent(admin, {
      propertyId: property.id as string,
      action: "property.create",
      entityType: "properties",
      entityId: property.id as string,
      summary: `Created property ${name}`,
    });

    revalidatePath("/erp");
    redirect(`/erp/properties/${property.id}/setup?step=2`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed.",
    };
  }
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function cloneRoomsAndSeasons(
  admin: Admin,
  fromId: string,
  toId: string,
) {
  const { data: types } = await admin
    .from("room_types")
    .select("code, name, inventory_kind, unit_count")
    .eq("property_id", fromId);
  if (types?.length) {
    await admin.from("room_types").insert(
      types.map((t) => ({
        property_id: toId,
        code: t.code,
        name: t.name,
        inventory_kind: t.inventory_kind,
        unit_count: t.unit_count ?? 0,
      })),
    );
  }

  const { data: seasons } = await admin
    .from("seasons")
    .select("kind, starts_on, ends_on")
    .eq("property_id", fromId);
  if (seasons?.length) {
    await admin.from("seasons").insert(
      seasons.map((s) => ({
        property_id: toId,
        kind: s.kind,
        starts_on: s.starts_on,
        ends_on: s.ends_on,
      })),
    );
  }

  const { data: fromTypes } = await admin
    .from("room_types")
    .select("id, code")
    .eq("property_id", fromId);
  const { data: toTypes } = await admin
    .from("room_types")
    .select("id, code")
    .eq("property_id", toId);
  const codeToNew = new Map(
    (toTypes ?? []).map((t) => [t.code as string, t.id as string]),
  );
  const codeToOld = new Map(
    (fromTypes ?? []).map((t) => [t.code as string, t.id as string]),
  );

  const { data: rates } = await admin
    .from("room_rates")
    .select("room_type_id, season_kind, rate_tier, amount_btn")
    .eq("property_id", fromId);
  const inserts = [];
  for (const r of rates ?? []) {
    let code: string | undefined;
    for (const [c, id] of codeToOld) {
      if (id === r.room_type_id) {
        code = c;
        break;
      }
    }
    const newTypeId = code ? codeToNew.get(code) : undefined;
    if (!newTypeId) continue;
    inserts.push({
      property_id: toId,
      room_type_id: newTypeId,
      season_kind: r.season_kind,
      rate_tier: r.rate_tier,
      amount_btn: r.amount_btn,
    });
  }
  if (inserts.length) await admin.from("room_rates").insert(inserts);
}

/** Step 2 — add room type quickly */
export async function savePropertyRoomsStep(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const code = trimRequired(formData.get("code"), "Room code").toLowerCase();
    const name = trimRequired(formData.get("name"), "Room name");
    const unitCount = Number(formData.get("unit_count") ?? 1) || 1;
    const kind = optionalTrim(formData.get("inventory_kind")) ?? "sellable_guest";

    const { error } = await admin.from("room_types").upsert(
      {
        property_id: propertyId,
        code,
        name,
        inventory_kind: kind,
        unit_count: unitCount,
      },
      { onConflict: "property_id,code" },
    );
    if (error) throw new Error(error.message);

    await admin
      .from("properties")
      .update({ setup_step: 3 })
      .eq("id", propertyId)
      .lt("setup_step", 3);

    revalidatePath(`/erp/properties/${propertyId}/setup`);
    return { ok: true, propertyId, message: "Room type saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** Step 3 — income streams */
export async function savePropertyIncomeStreams(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");

    const outlets = formData.getAll("outlets").map(String);
    const services = formData.getAll("services").map(String);
    const guestServices = formData.getAll("guest_services").map(String);
    const channel = formData.get("channel") === "1";

    const streams: IncomeStreams = {
      rooms: true,
      outlets,
      services,
      guest_services: guestServices,
      channel,
    };

    const { error } = await admin
      .from("properties")
      .update({ income_streams: streams, setup_step: 4 })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath(`/erp/properties/${propertyId}/setup`);
    redirect(`/erp/properties/${propertyId}/setup?step=4`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** Step 4 — deposit + TTL floor */
export async function savePropertyDepositRules(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const mode = optionalTrim(formData.get("mode")) ?? "one_night";
    const floor = Number(formData.get("floor_btn") ?? 2000) || 0;
    const percentRaw = optionalTrim(formData.get("percent"));
    const bankHint = optionalTrim(formData.get("bank_hint"));

    await admin.from("property_deposit_rules").upsert({
      property_id: propertyId,
      mode,
      floor_btn: floor,
      percent: percentRaw ? Number(percentRaw) : null,
      bank_hint: bankHint,
      updated_at: new Date().toISOString(),
    });

    // Optional TTL overrides for client peak/lean/off
    for (const season of ["peak", "lean", "off"] as const) {
      const raw = optionalTrim(formData.get(`ttl_client_${season}`));
      if (!raw) continue;
      const hours = Number(raw);
      if (!Number.isFinite(hours) || hours < 1) continue;
      await admin.from("hold_ttl_rules").upsert(
        {
          property_id: propertyId,
          source: "client",
          season_kind: season,
          ttl_hours: hours,
        },
        { onConflict: "property_id,source,season_kind" },
      );
    }

    await admin
      .from("properties")
      .update({ setup_step: 5 })
      .eq("id", propertyId);

    revalidatePath(`/erp/properties/${propertyId}/setup`);
    redirect(`/erp/properties/${propertyId}/setup?step=5`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** Step 5 — banks + complete */
export async function savePropertyBanksAndComplete(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const label = optionalTrim(formData.get("bank_label"));
    const bank = optionalTrim(formData.get("bank_name"));
    const account = optionalTrim(formData.get("bank_account"));
    const hint = optionalTrim(formData.get("bank_hint"));

    const accounts =
      label || bank || account
        ? [{ label: label ?? "Primary", bank, account, hint }]
        : [];

    const { error } = await admin
      .from("properties")
      .update({
        bank_accounts: accounts,
        setup_step: 5,
        setup_completed_at: new Date().toISOString(),
      })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    if (hint) {
      await admin
        .from("property_deposit_rules")
        .update({ bank_hint: hint })
        .eq("property_id", propertyId);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.setup_complete",
      entityType: "properties",
      entityId: propertyId,
      summary: "Hotel setup wizard completed",
    });

    revalidatePath("/erp");
    redirect("/erp");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}
