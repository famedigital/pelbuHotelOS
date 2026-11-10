"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  ACTIVE_PROPERTY_COOKIE,
  DEFAULT_INCOME_STREAMS,
  slugifyHotelName,
  type IncomeStreams,
} from "@/lib/property-context";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
import { syncRoomUnits } from "@/lib/rooms/sync-room-units";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired, assertOptionalEmail, assertPhone } from "@/lib/validation";
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

const RATE_TIERS = [
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
] as const;

const INVENTORY_KINDS = new Set([
  "sellable_guest",
  "guide_comp",
  "driver_comp",
  "staff",
]);

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function revalidateSetup(propertyId: string) {
  revalidatePath(`/erp/properties/${propertyId}/setup`);
  revalidatePath("/erp");
  revalidatePath("/erp/settings");
  revalidatePath("/erp/rates");
  revalidatePath("/erp/rooms");
  revalidatePath("/erp/calendar");
  revalidatePath("/book");
}

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

/** Default Bhutan calendar season windows for greenfield properties. */
async function ensureDefaultSeasons(admin: Admin, propertyId: string) {
  const { count } = await admin
    .from("seasons")
    .select("*", { count: "exact", head: true })
    .eq("property_id", propertyId);
  if ((count ?? 0) > 0) return;

  const year = new Date().getFullYear();
  const windows = [
    { kind: "peak", starts_on: `${year}-03-01`, ends_on: `${year}-05-31` },
    { kind: "lean", starts_on: `${year}-06-01`, ends_on: `${year}-08-31` },
    { kind: "off", starts_on: `${year}-09-01`, ends_on: `${year}-11-30` },
    {
      kind: "peak",
      starts_on: `${year}-12-01`,
      ends_on: `${year + 1}-02-28`,
    },
  ];
  await admin.from("seasons").insert(
    windows.map((w) => ({ property_id: propertyId, ...w })),
  );
}

async function ensureRateTiers(admin: Admin, propertyId: string) {
  await admin.from("rate_tiers").upsert(
    RATE_TIERS.map((code) => ({ property_id: propertyId, code })),
    { onConflict: "property_id,code" },
  );
}

async function bumpSetupStep(admin: Admin, propertyId: string, step: number) {
  await admin
    .from("properties")
    .update({ setup_step: step })
    .eq("id", propertyId)
    .lt("setup_step", step);
}

/** Step 1 — create property identity (greenfield hotel). */
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
    const legalName = optionalTrim(formData.get("legal_name")) ?? name;
    const address = optionalTrim(formData.get("address"));
    const phoneRaw = optionalTrim(formData.get("phone"));
    const emailRaw = optionalTrim(formData.get("email"));
    if (emailRaw) assertOptionalEmail(emailRaw);
    const taxId = optionalTrim(formData.get("tax_id"));

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
        setup_completed_at: null,
        legal_name: legalName,
        address,
        phone: phoneRaw,
        email: emailRaw,
        tax_id: taxId,
        income_streams: DEFAULT_INCOME_STREAMS,
        bank_accounts: [],
      })
      .select("id")
      .single();
    if (error || !property) {
      console.error("createPropertyIdentity", error);
      throw new Error("Could not create property.");
    }

    const propertyId = property.id as string;
    await seedHoldRules(propertyId);
    await ensureRateTiers(admin, propertyId);
    await ensureDefaultSeasons(admin, propertyId);

    if (cloneFrom) {
      const { data: flagship } = await admin
        .from("properties")
        .select("id")
        .eq("slug", DEFAULT_PROPERTY_SLUG)
        .maybeSingle();
      if (flagship) {
        await cloneRoomsAndSeasons(admin, flagship.id as string, propertyId);
      }
    }

    const jar = await cookies();
    jar.set(ACTIVE_PROPERTY_COOKIE, propertyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.create",
      entityType: "properties",
      entityId: propertyId,
      summary: `Created property ${name}`,
    });

    revalidatePath("/erp");
    redirect(`/erp/properties/${propertyId}/setup?step=2`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed.",
    };
  }
}

/** Step 1 — update identity for an existing hotel (post-wipe re-setup). */
export async function savePropertyIdentityStep(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const name = trimRequired(formData.get("name"), "Hotel name");
    const legalName = optionalTrim(formData.get("legal_name")) ?? name;
    const timezone =
      optionalTrim(formData.get("timezone")) ?? "Asia/Thimphu";
    const address = optionalTrim(formData.get("address"));
    const phoneRaw = optionalTrim(formData.get("phone"));
    const emailRaw = optionalTrim(formData.get("email"));
    if (emailRaw) assertOptionalEmail(emailRaw);
    const taxId = optionalTrim(formData.get("tax_id"));

    const { error } = await admin
      .from("properties")
      .update({
        name,
        legal_name: legalName,
        timezone,
        address,
        phone: phoneRaw,
        email: emailRaw,
        tax_id: taxId,
      })
      .eq("id", propertyId);
    if (error) throw new Error(error.message);

    await seedHoldRules(propertyId);
    await ensureRateTiers(admin, propertyId);
    await ensureDefaultSeasons(admin, propertyId);
    await bumpSetupStep(admin, propertyId, 2);

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.setup.identity",
      entityType: "properties",
      entityId: propertyId,
      summary: `Setup identity saved for ${name}`,
    });

    revalidateSetup(propertyId);
    redirect(`/erp/properties/${propertyId}/setup?step=2`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

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

  // Seasons already seeded on create; only clone when target is empty of custom windows
  const { count: seasonCount } = await admin
    .from("seasons")
    .select("*", { count: "exact", head: true })
    .eq("property_id", toId);
  if ((seasonCount ?? 0) === 0) {
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
  }

  const { data: fromTypes } = await admin
    .from("room_types")
    .select("id, code, unit_count")
    .eq("property_id", fromId);
  const { data: toTypes } = await admin
    .from("room_types")
    .select("id, code, unit_count")
    .eq("property_id", toId);
  const codeToNew = new Map(
    (toTypes ?? []).map((t) => [t.code as string, t]),
  );
  const codeToOld = new Map(
    (fromTypes ?? []).map((t) => [t.code as string, t.id as string]),
  );

  for (const t of toTypes ?? []) {
    await syncRoomUnits(
      admin,
      toId,
      t.id as string,
      t.code as string,
      Number(t.unit_count ?? 0),
    );
  }

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
    const newType = code ? codeToNew.get(code) : undefined;
    if (!newType) continue;
    inserts.push({
      property_id: toId,
      room_type_id: newType.id as string,
      season_kind: r.season_kind,
      rate_tier: r.rate_tier,
      amount_btn: r.amount_btn,
    });
  }
  if (inserts.length) await admin.from("room_rates").insert(inserts);
}

/** Step 2 — add / update room type + physical units. */
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
    const unitCount = Number(formData.get("unit_count") ?? 1) || 0;
    if (!Number.isInteger(unitCount) || unitCount < 0 || unitCount > 500) {
      throw new Error("Unit count must be a whole number between 0 and 500.");
    }
    const kindRaw =
      optionalTrim(formData.get("inventory_kind")) ?? "sellable_guest";
    if (!INVENTORY_KINDS.has(kindRaw)) {
      throw new Error("Invalid inventory kind.");
    }

    const { data: upserted, error } = await admin
      .from("room_types")
      .upsert(
        {
          property_id: propertyId,
          code,
          name,
          inventory_kind: kindRaw,
          unit_count: unitCount,
        },
        { onConflict: "property_id,code" },
      )
      .select("id")
      .single();
    if (error || !upserted) throw new Error(error?.message ?? "Could not save room type.");

    await syncRoomUnits(admin, propertyId, upserted.id as string, code, unitCount);
    await bumpSetupStep(admin, propertyId, 2);

    revalidateSetup(propertyId);
    return { ok: true, propertyId, message: "Room type and doors saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** Step 2 continue — require inventory before rates. */
export async function continuePropertyRoomsStep(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");

    const { data: types } = await admin
      .from("room_types")
      .select("id, code, unit_count, inventory_kind")
      .eq("property_id", propertyId);
    if (!types?.length) {
      throw new Error("Add at least one room category before continuing.");
    }

    const hasSellable = types.some(
      (t) => (t.inventory_kind as string) === "sellable_guest",
    );
    if (!hasSellable) {
      throw new Error(
        "Add at least one Sellable guest category before rates. Guide, driver, and staff types do not get public rates.",
      );
    }

    // Repair units after selective room-unit wipe (counts may still be set).
    for (const t of types) {
      await syncRoomUnits(
        admin,
        propertyId,
        t.id as string,
        t.code as string,
        Number(t.unit_count ?? 0),
      );
    }

    const { data: sellableTypes } = await admin
      .from("room_types")
      .select("id")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest");
    const sellableIds = new Set((sellableTypes ?? []).map((t) => t.id as string));

    const { count: unitCount } = await admin
      .from("room_units")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId);
    if ((unitCount ?? 0) < 1) {
      throw new Error(
        "Add units (doors) to at least one category so the room rack can assign stays.",
      );
    }

    const { count: sellableDoors } = await admin
      .from("room_units")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .in("room_type_id", [...sellableIds]);
    if ((sellableDoors ?? 0) < 1) {
      throw new Error(
        "Add doors on a sellable guest category (not only guide/driver/staff) before rates.",
      );
    }

    await bumpSetupStep(admin, propertyId, 3);
    revalidateSetup(propertyId);
    redirect(`/erp/properties/${propertyId}/setup?step=3`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not continue.",
    };
  }
}

/** Step 3 — public + agents rates per room type × season. */
export async function savePropertyRatesStep(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");

    await ensureDefaultSeasons(admin, propertyId);
    await ensureRateTiers(admin, propertyId);

    const { data: sellable } = await admin
      .from("room_types")
      .select("id")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest");

    if (!sellable?.length) {
      throw new Error(
        "Add a sellable guest room category first (step 2), then set rates.",
      );
    }

    let saved = 0;
    for (const rt of sellable) {
      const typeId = rt.id as string;
      for (const season of ["peak", "lean", "off"] as const) {
        const amounts: Partial<Record<"public" | "agents", number>> = {};
        for (const tier of ["public", "agents"] as const) {
          const key = `rate_${typeId}_${season}_${tier}`;
          const raw = optionalTrim(formData.get(key));
          if (raw == null || raw === "") continue;
          const amount = Number(raw);
          if (!Number.isFinite(amount) || amount < 0) {
            throw new Error("Rates must be non-negative numbers in Nu (not %).");
          }
          amounts[tier] = amount;
        }

        // Empty agent cell → store Nu at ~85% of public (never a percent field).
        if (
          amounts.public != null &&
          amounts.agents == null
        ) {
          amounts.agents = Math.round(amounts.public * 0.85);
        }

        for (const tier of ["public", "agents"] as const) {
          const amount = amounts[tier];
          if (amount == null) continue;

          const { data: existing } = await admin
            .from("room_rates")
            .select("id")
            .eq("property_id", propertyId)
            .eq("room_type_id", typeId)
            .eq("season_kind", season)
            .eq("rate_tier", tier)
            .maybeSingle();

          if (existing?.id) {
            const { error } = await admin
              .from("room_rates")
              .update({ amount_btn: amount })
              .eq("id", existing.id);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await admin.from("room_rates").insert({
              property_id: propertyId,
              room_type_id: typeId,
              season_kind: season,
              rate_tier: tier,
              amount_btn: amount,
            });
            if (error) throw new Error(error.message);
          }
          saved += 1;
        }
      }
    }

    if (saved === 0) {
      throw new Error(
        "Enter at least one rate in Nu (public peak is a good start) before continuing.",
      );
    }

    // Derive friends/family/mou from public when those cells are empty — ops can refine at /erp/rates.
    for (const rt of sellable) {
      const typeId = rt.id as string;
      for (const season of ["peak", "lean", "off"] as const) {
        const { data: publicRate } = await admin
          .from("room_rates")
          .select("amount_btn")
          .eq("property_id", propertyId)
          .eq("room_type_id", typeId)
          .eq("season_kind", season)
          .eq("rate_tier", "public")
          .maybeSingle();
        if (!publicRate) continue;
        const base = Number(publicRate.amount_btn);
        const { data: agentsRate } = await admin
          .from("room_rates")
          .select("amount_btn")
          .eq("property_id", propertyId)
          .eq("room_type_id", typeId)
          .eq("season_kind", season)
          .eq("rate_tier", "agents")
          .maybeSingle();
        const agentsAmount = agentsRate
          ? Number(agentsRate.amount_btn)
          : Math.round(base * 0.85);

        const derived: [string, number][] = [
          ["friends", Math.round(base * 0.9)],
          ["family", Math.round(base * 0.85)],
          ["mutual_friends", Math.round(base * 0.88)],
          ["mou_agents", Math.round(agentsAmount * 0.95)],
        ];
        for (const [tier, amount] of derived) {
          const { data: existing } = await admin
            .from("room_rates")
            .select("id")
            .eq("property_id", propertyId)
            .eq("room_type_id", typeId)
            .eq("season_kind", season)
            .eq("rate_tier", tier)
            .maybeSingle();
          if (existing?.id) continue;
          await admin.from("room_rates").insert({
            property_id: propertyId,
            room_type_id: typeId,
            season_kind: season,
            rate_tier: tier,
            amount_btn: amount,
          });
        }
      }
    }

    await bumpSetupStep(admin, propertyId, 4);
    revalidateSetup(propertyId);
    redirect(`/erp/properties/${propertyId}/setup?step=4`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** Step 4 — income streams + deposit / hold TTL. */
export async function savePropertyCommercialStep(
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

    const mode = optionalTrim(formData.get("mode")) ?? "one_night";
    const floor = Number(formData.get("floor_btn") ?? 2000) || 0;
    const percentRaw = optionalTrim(formData.get("percent"));
    const bankHint = optionalTrim(formData.get("bank_hint"));

    const { error: streamsError } = await admin
      .from("properties")
      .update({ income_streams: streams, setup_step: 5 })
      .eq("id", propertyId);
    if (streamsError) throw new Error(streamsError.message);

    await admin.from("property_deposit_rules").upsert({
      property_id: propertyId,
      mode,
      floor_btn: floor,
      percent: percentRaw ? Number(percentRaw) : null,
      bank_hint: bankHint,
      updated_at: new Date().toISOString(),
    });

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

    revalidateSetup(propertyId);
    redirect(`/erp/properties/${propertyId}/setup?step=5`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** @deprecated Use savePropertyCommercialStep — kept for old form posts. */
export async function savePropertyIncomeStreams(
  prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  return savePropertyCommercialStep(prev, formData);
}

/** @deprecated Use savePropertyCommercialStep. */
export async function savePropertyDepositRules(
  prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  return savePropertyCommercialStep(prev, formData);
}

/** Step 5 — optional staff, then banks + complete. */
export async function savePropertyStaffStep(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const fullName = trimRequired(formData.get("full_name"), "Name");
    const role =
      optionalTrim(formData.get("role_label"))?.toLowerCase() ?? "front_desk";
    const STAFF_ROLES = new Set([
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
    ]);
    if (!STAFF_ROLES.has(role)) throw new Error("Invalid staff role.");
    const employeeCode =
      optionalTrim(formData.get("employee_code"))
        ?.toUpperCase()
        .replace(/\s+/g, "-") ??
      `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const { data, error } = await admin
      .from("staff_members")
      .insert({
        property_id: propertyId,
        employee_code: employeeCode,
        full_name: fullName,
        role_label: role,
        phone: optionalTrim(formData.get("phone")),
        email: optionalTrim(formData.get("email")),
        status: "active",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("setup staff insert", error);
      throw new Error("Could not save staff member.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.setup.staff",
      entityType: "staff_members",
      entityId: data.id as string,
      summary: `Setup wizard added staff ${fullName}`,
    });

    revalidateSetup(propertyId);
    revalidatePath("/erp/hr");
    return { ok: true, propertyId, message: `${fullName} added.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not add staff.",
    };
  }
}

/** Step 5 — optional trade partner. */
export async function savePropertyAgentStep(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const companyName = trimRequired(formData.get("company_name"), "Company name");
    const market =
      optionalTrim(formData.get("market"))?.toLowerCase() ?? "bhutan";
    if (!["bhutan", "jaigaon", "india"].includes(market)) {
      throw new Error("Market must be Bhutan, Jaigaon, or India.");
    }
    const contactName = trimRequired(formData.get("contact_name"), "Contact name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);
    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const { data: agent, error } = await admin
      .from("agents")
      .insert({
        company_name: companyName,
        market,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        status: "approved",
        rate_tier: "agents",
        credit_limit: 0,
        credit_used: 0,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !agent) {
      console.error("setup agent insert", error);
      throw new Error("Could not create agent.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.setup.agent",
      entityType: "agents",
      entityId: agent.id as string,
      summary: `Setup wizard added agent ${companyName}`,
    });

    revalidateSetup(propertyId);
    revalidatePath("/erp/agents");
    return { ok: true, propertyId, message: `${companyName} added.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not add agent.",
    };
  }
}

/** Step 5 — banks + mark setup complete. */
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

    // Ensure commercial scaffolding if operator skipped via nav
    await seedHoldRules(propertyId);
    await ensureDefaultSeasons(admin, propertyId);
    await ensureRateTiers(admin, propertyId);

    const { count: typeCount } = await admin
      .from("room_types")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId);
    if ((typeCount ?? 0) < 1) {
      throw new Error("Add room inventory (step 2) before finishing setup.");
    }

    const { count: unitCount } = await admin
      .from("room_units")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId);
    if ((unitCount ?? 0) < 1) {
      throw new Error(
        "Create physical room doors on step 2 before finishing setup.",
      );
    }

    const { count: rateCount } = await admin
      .from("room_rates")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId);
    if ((rateCount ?? 0) < 1) {
      throw new Error("Set at least one room rate (step 3) before finishing.");
    }

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

    revalidateSetup(propertyId);
    revalidatePath("/erp/hr");
    revalidatePath("/erp/agents");
    redirect("/erp");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

/** Re-open wizard after master data wipe (clears completed flag so desk banners show). */
export async function reopenPropertySetup(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    const startStep = Math.min(
      5,
      Math.max(1, Number(formData.get("start_step") ?? 1) || 1),
    );

    await admin
      .from("properties")
      .update({
        setup_completed_at: null,
        setup_step: startStep,
      })
      .eq("id", propertyId);

    revalidateSetup(propertyId);
    redirect(`/erp/properties/${propertyId}/setup?step=${startStep}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reopen setup.",
    };
  }
}
