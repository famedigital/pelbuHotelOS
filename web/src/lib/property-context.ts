import { cookies } from "next/headers";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import {
  mapPropertySettings,
  type PropertySettings,
} from "@/lib/property-settings";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const ACTIVE_PROPERTY_COOKIE = "pelbu_active_property";

export type PropertyRow = {
  id: string;
  slug: string;
  name: string;
  template_id: number;
  timezone: string;
  setup_step: number;
  setup_completed_at: string | null;
  income_streams: IncomeStreams;
  bank_accounts: BankAccount[];
} & PropertySettings;

export type IncomeStreams = {
  rooms: boolean;
  outlets: string[];
  services: string[];
  guest_services: string[];
  channel: boolean;
};

export type BankAccount = {
  label: string;
  bank?: string;
  account?: string;
  hint?: string;
};

export const DEFAULT_INCOME_STREAMS: IncomeStreams = {
  rooms: true,
  outlets: ["cafe", "pastry", "restaurant", "bar"],
  services: ["spa", "meeting", "steam"],
  guest_services: ["taxi", "shop", "other"],
  channel: false,
};

/** Active property for desk session; falls back to flagship slug. */
export async function resolveActivePropertyId(
  admin: Admin,
): Promise<string> {
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
  return propertyIdBySlug(admin, PELBU_PROPERTY_SLUG);
}

export async function propertyIdBySlug(
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

export async function loadProperty(
  admin: Admin,
  id: string,
): Promise<PropertyRow | null> {
  const { data } = await admin
    .from("properties")
    .select(
      "id, slug, name, template_id, timezone, setup_step, setup_completed_at, income_streams, bank_accounts, logo_public_id, legal_name, address, phone, email, tax_id, gst_rate, service_charge_rate, service_charge_default_on, doc_invoice, doc_receipt, doc_voucher",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return mapProperty(data);
}

export async function listProperties(admin: Admin): Promise<PropertyRow[]> {
  const { data } = await admin
    .from("properties")
    .select(
      "id, slug, name, template_id, timezone, setup_step, setup_completed_at, income_streams, bank_accounts, logo_public_id, legal_name, address, phone, email, tax_id, gst_rate, service_charge_rate, service_charge_default_on, doc_invoice, doc_receipt, doc_voucher",
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
