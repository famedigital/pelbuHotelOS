import "server-only";

import {
  mapPropertyMediaRow,
  PROPERTY_MEDIA_SELECT,
  type PropertyMediaRow,
  type PropertyMediaScope,
} from "@/lib/property-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LoadPropertyMediaOpts = {
  scope?: PropertyMediaScope;
  scopeId?: string | null;
  facet?: string;
  /** When true (default for public helper), only published. Admin/ERP pass false. */
  publishedOnly?: boolean;
};

export async function loadPropertyMediaForProperty(
  admin: SupabaseClient,
  propertyId: string,
  opts: LoadPropertyMediaOpts = {},
): Promise<PropertyMediaRow[]> {
  let q = admin
    .from("property_media")
    .select(PROPERTY_MEDIA_SELECT)
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (opts.publishedOnly) q = q.eq("is_published", true);
  if (opts.scope) q = q.eq("scope", opts.scope);
  if (opts.scopeId !== undefined) {
    if (opts.scopeId === null) q = q.is("scope_id", null);
    else q = q.eq("scope_id", opts.scopeId);
  }
  if (opts.facet) q = q.eq("facet", opts.facet);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapPropertyMediaRow(row as Record<string, unknown>),
  );
}

/** Public-only media (published). Empty when no flagship property. */
export async function loadPublicPropertyMedia(
  opts: Omit<LoadPropertyMediaOpts, "publishedOnly"> = {},
): Promise<PropertyMediaRow[]> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return [];
  const admin = createSupabaseAdminClient();
  return loadPropertyMediaForProperty(admin, propertyId, {
    ...opts,
    publishedOnly: true,
  });
}

export async function loadPublicMediaByRoomTypeIds(
  roomTypeIds: string[],
): Promise<Map<string, PropertyMediaRow[]>> {
  const map = new Map<string, PropertyMediaRow[]>();
  if (roomTypeIds.length === 0) return map;
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return map;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("property_media")
    .select(PROPERTY_MEDIA_SELECT)
    .eq("property_id", propertyId)
    .eq("scope", "room_type")
    .eq("is_published", true)
    .in("scope_id", roomTypeIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const media = mapPropertyMediaRow(row as Record<string, unknown>);
    const id = media.scope_id!;
    const list = map.get(id) ?? [];
    list.push(media);
    map.set(id, list);
  }
  return map;
}

export async function loadPublicFoodMedia(): Promise<PropertyMediaRow[]> {
  return loadPublicPropertyMedia({ scope: "menu_item" });
}

export async function loadPublicPropertyAreaMedia(): Promise<PropertyMediaRow[]> {
  return loadPublicPropertyMedia({ scope: "property_area" });
}

export type PublicTeamMember = {
  id: string;
  name: string;
  roleLabel: string;
  phone: string | null;
  whatsappUrl: string | null;
  portraitPublicId: string | null;
  portraitResourceType: "image" | "video";
};

/** Digits-only for wa.me; keeps leading country code when present. */
export function whatsappMeUrl(
  phone: string | null | undefined,
  greeting?: string,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const q = greeting ? `?text=${encodeURIComponent(greeting)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export async function loadPublicTeamMembers(): Promise<PublicTeamMember[]> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return [];
  const admin = createSupabaseAdminClient();

  const { data: staff, error } = await admin
    .from("staff_members")
    .select("id, full_name, role_label, team_role_label, phone, team_sort_order")
    .eq("property_id", propertyId)
    .eq("show_on_team", true)
    .eq("status", "active")
    .order("team_sort_order", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  if (!staff?.length) return [];

  const ids = staff.map((s) => s.id as string);
  const { data: media } = await admin
    .from("property_media")
    .select(PROPERTY_MEDIA_SELECT)
    .eq("property_id", propertyId)
    .eq("scope", "staff")
    .eq("is_published", true)
    .in("scope_id", ids)
    .order("sort_order", { ascending: true });

  const byStaff = new Map<string, PropertyMediaRow[]>();
  for (const row of media ?? []) {
    const m = mapPropertyMediaRow(row as Record<string, unknown>);
    if (!m.scope_id) continue;
    const list = byStaff.get(m.scope_id) ?? [];
    list.push(m);
    byStaff.set(m.scope_id, list);
  }

  return staff.map((s) => {
    const id = s.id as string;
    const assets = byStaff.get(id) ?? [];
    const portrait =
      assets.find((a) => a.facet === "portrait" && a.is_primary) ??
      assets.find((a) => a.facet === "portrait") ??
      assets.find((a) => a.is_primary) ??
      assets[0] ??
      null;
    const phone = (s.phone as string | null) ?? null;
    const name = s.full_name as string;
    return {
      id,
      name,
      roleLabel:
        (s.team_role_label as string | null)?.trim() ||
        (s.role_label as string) ||
        "Team",
      phone,
      whatsappUrl: whatsappMeUrl(
        phone,
        `Hello ${name.split(" ")[0] ?? ""}, I am enquiring about Pelbu Suites.`,
      ),
      portraitPublicId: portrait?.public_id ?? null,
      portraitResourceType: portrait?.resource_type ?? "image",
    };
  });
}
