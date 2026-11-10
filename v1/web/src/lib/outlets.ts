import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveActivePropertyId } from "@/lib/property-context";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type PropertyOutlet = {
  id: string;
  property_id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

/** Legacy defaults used when a property has no rows yet (pre-migration fallback). */
export const LEGACY_OUTLET_DEFS: { code: string; name: string; sort_order: number }[] =
  [
    { code: "cafe", name: "Cafe", sort_order: 10 },
    { code: "pastry", name: "Pastry", sort_order: 20 },
    { code: "restaurant", name: "Restaurant", sort_order: 30 },
    { code: "bar", name: "Bar", sort_order: 40 },
  ];

/** Public online order still only accepts these three (bar is browse-only). */
export const ONLINE_ORDER_OUTLETS = new Set(["cafe", "pastry", "restaurant"]);

const CODE_RE = /^[a-z][a-z0-9_]{0,31}$/;

/** Normalize a display name into a stable outlet code. */
export function slugifyOutletCode(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 32);
  if (!CODE_RE.test(slug)) {
    throw new Error(
      "Outlet code must start with a letter and use only lowercase letters, numbers, or underscores.",
    );
  }
  return slug;
}

export function assertOutletCode(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (!CODE_RE.test(trimmed)) {
    throw new Error(
      "Outlet code must start with a letter and use only lowercase letters, numbers, or underscores.",
    );
  }
  return trimmed;
}

function mapRow(row: Record<string, unknown>): PropertyOutlet {
  return {
    id: row.id as string,
    property_id: row.property_id as string,
    code: row.code as string,
    name: row.name as string,
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export async function loadPropertyOutlets(
  admin: Admin,
  propertyId?: string,
  options: { activeOnly?: boolean } = {},
): Promise<PropertyOutlet[]> {
  const pid = propertyId ?? (await resolveActivePropertyId(admin));
  let query = admin
    .from("property_outlets")
    .select("id, property_id, code, name, is_active, sort_order")
    .eq("property_id", pid)
    .order("sort_order")
    .order("name");

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Could not load outlets.");
  }

  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  if (rows.length > 0) return rows;

  // Pre-migration / empty property fallback — do not invent DB rows here.
  return LEGACY_OUTLET_DEFS.map((def, i) => ({
    id: `legacy-${def.code}`,
    property_id: pid,
    code: def.code,
    name: def.name,
    is_active: true,
    sort_order: def.sort_order || (i + 1) * 10,
  }));
}

export async function loadActiveOutletCodes(
  admin: Admin,
  propertyId?: string,
): Promise<string[]> {
  const outlets = await loadPropertyOutlets(admin, propertyId, {
    activeOnly: true,
  });
  return outlets.map((o) => o.code);
}

/** Throws if the outlet is missing or archived (unless allowArchived). */
export async function assertPropertyOutlet(
  admin: Admin,
  propertyId: string,
  code: string,
  options: { allowArchived?: boolean } = {},
): Promise<PropertyOutlet> {
  const normalized = assertOutletCode(code);
  const { data, error } = await admin
    .from("property_outlets")
    .select("id, property_id, code, name, is_active, sort_order")
    .eq("property_id", propertyId)
    .eq("code", normalized)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Choose a valid outlet.");
  }
  const outlet = mapRow(data as Record<string, unknown>);
  if (!outlet.is_active && !options.allowArchived) {
    throw new Error(
      `"${outlet.name}" is archived. Restore it before assigning new items.`,
    );
  }
  return outlet;
}

export function outletLabel(
  outlets: PropertyOutlet[],
  code: string,
): string {
  return outlets.find((o) => o.code === code)?.name ?? code;
}

/** Sync income_streams.outlets JSON so property setup stays consistent. */
export async function syncIncomeStreamOutlets(
  admin: Admin,
  propertyId: string,
): Promise<void> {
  const active = await loadPropertyOutlets(admin, propertyId, {
    activeOnly: true,
  });
  const codes = active
    .filter((o) => !o.id.startsWith("legacy-"))
    .map((o) => o.code);

  const { data: property } = await admin
    .from("properties")
    .select("income_streams")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return;

  const streams =
    property.income_streams && typeof property.income_streams === "object"
      ? { ...(property.income_streams as Record<string, unknown>) }
      : {};

  await admin
    .from("properties")
    .update({
      income_streams: {
        ...streams,
        outlets: codes,
      },
    })
    .eq("id", propertyId);
}
