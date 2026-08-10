import { cache } from "react";
import { cookies, headers } from "next/headers";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { mapPropertySettings } from "@/lib/property-settings";
import {
  DEFAULT_INCOME_STREAMS,
  type BankAccount,
  type IncomeStreams,
  type PropertyRow,
} from "@/lib/property-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const ACTIVE_PROPERTY_COOKIE = "pelbu_active_property";

export type {
  BankAccount,
  IncomeStreams,
  PropertyRow,
  PropertySwitcherOption,
} from "@/lib/property-types";
export { DEFAULT_INCOME_STREAMS } from "@/lib/property-types";

const resolveActivePropertyIdImpl = cache(async (): Promise<string> => {
  const admin = createSupabaseAdminClient();
  const jar = await cookies();
  const cookieId = jar.get(ACTIVE_PROPERTY_COOKIE)?.value?.trim();
  if (cookieId) {
    const { data } = await admin
      .from("properties")
      .select("id")
      .eq("id", cookieId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  try {
    const h = await headers();
    const hostPropertyId = h.get("x-pelbu-property-id")?.trim();
    if (hostPropertyId) {
      const { data } = await admin
        .from("properties")
        .select("id")
        .eq("id", hostPropertyId)
        .maybeSingle();
      if (data?.id) return data.id as string;
    }
  } catch {
    // headers() unavailable outside request scope
  }

  return propertyIdBySlugUncached(admin, PELBU_PROPERTY_SLUG);
});

/** Active property for desk session; falls back to Host header then flagship slug. */
export async function resolveActivePropertyId(
  admin: Admin,
): Promise<string> {
  void admin;
  return resolveActivePropertyIdImpl();
}

export async function propertyIdBySlug(
  admin: Admin,
  slug: string,
): Promise<string> {
  return propertyIdBySlugUncached(admin, slug);
}

async function propertyIdBySlugUncached(
  admin: Admin,
  slug: string,
): Promise<string> {
  const { data, error } = await admin
    .from("properties")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error || !data) {
    throw new Error("Hotel property is not configured.");
  }
  return data.id as string;
}

const loadPropertyCached = cache(
  async (id: string): Promise<PropertyRow | null> => {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("properties")
      .select(
        "id, slug, name, template_id, timezone, setup_step, setup_completed_at, income_streams, bank_accounts, logo_public_id, logo_nav_size_rem, logo_nav_offset_pct, logo_nav_gap_rem, logo_nav_shift_x_rem, legal_name, address, phone, whatsapp, email, tax_id, gst_rate, service_charge_rate, service_charge_default_on, post_day1_room_at_checkin, doc_invoice, doc_receipt, doc_voucher, doc_settlement, doc_registration, public_host, desk_host, night_audit_close_time, current_business_date, public_host_cert_status, desk_host_cert_status, host_verify_token, product_pack, pos_training_mode",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return mapProperty(data);
  },
);

export async function loadProperty(
  admin: Admin,
  id: string,
): Promise<PropertyRow | null> {
  void admin;
  return loadPropertyCached(id);
}

export async function listProperties(admin: Admin): Promise<PropertyRow[]> {
  const { data } = await admin
    .from("properties")
    .select(
      "id, slug, name, template_id, timezone, setup_step, setup_completed_at, income_streams, bank_accounts, logo_public_id, logo_nav_size_rem, logo_nav_offset_pct, logo_nav_gap_rem, logo_nav_shift_x_rem, legal_name, address, phone, whatsapp, email, tax_id, gst_rate, service_charge_rate, service_charge_default_on, post_day1_room_at_checkin, doc_invoice, doc_receipt, doc_voucher, doc_settlement, doc_registration, public_host, desk_host, night_audit_close_time, current_business_date, public_host_cert_status, desk_host_cert_status, host_verify_token, product_pack, pos_training_mode",
    )
    .order("name");
  return (data ?? []).map(mapProperty);
}

function mapProperty(row: Record<string, unknown>): PropertyRow {
  const streams = (row.income_streams ?? DEFAULT_INCOME_STREAMS) as IncomeStreams;
  const banks = (row.bank_accounts ?? []) as BankAccount[];
  const settings = mapPropertySettings(row);
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    template_id: Number(row.template_id ?? 1),
    timezone: (row.timezone as string) ?? "Asia/Thimphu",
    setup_step: Number(row.setup_step ?? 1),
    setup_completed_at: (row.setup_completed_at as string | null) ?? null,
    income_streams: {
      rooms: streams.rooms !== false,
      outlets: Array.isArray(streams.outlets) ? streams.outlets : [],
      services: Array.isArray(streams.services) ? streams.services : [],
      guest_services: Array.isArray(streams.guest_services)
        ? streams.guest_services
        : [],
      channel: Boolean(streams.channel),
    },
    bank_accounts: Array.isArray(banks) ? banks : [],
    public_host: (row.public_host as string | null) ?? null,
    desk_host: (row.desk_host as string | null) ?? null,
    night_audit_close_time:
      (row.night_audit_close_time as string | undefined) ?? "00:00",
    current_business_date:
      (row.current_business_date as string | null | undefined)?.slice(0, 10) ??
      null,
    public_host_cert_status:
      (row.public_host_cert_status as string | undefined) ?? "none",
    desk_host_cert_status:
      (row.desk_host_cert_status as string | undefined) ?? "none",
    host_verify_token: (row.host_verify_token as string | null) ?? null,
    product_pack:
      row.product_pack === "restaurant" ? "restaurant" : "hotel",
    pos_training_mode: Boolean(row.pos_training_mode),
    ...settings,
  };
}

export function slugifyHotelName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
