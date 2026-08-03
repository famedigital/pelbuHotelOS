/**
 * Property shape shared with Client Components (shell, switcher, receipts).
 * Keep this free of next/headers, cookies, and Supabase admin — only types.
 */
import type { PropertySettings } from "@/lib/property-settings";

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

/** Fields the property switcher needs in the desk header. */
export type PropertySwitcherOption = {
  id: string;
  name: string;
  setup_completed_at: string | null;
};

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
  public_host?: string | null;
  desk_host?: string | null;
  night_audit_close_time?: string;
  post_day1_room_at_checkin?: boolean;
  public_host_cert_status?: string;
  desk_host_cert_status?: string;
  host_verify_token?: string | null;
} & PropertySettings;

export const DEFAULT_INCOME_STREAMS: IncomeStreams = {
  rooms: true,
  outlets: ["cafe", "pastry", "restaurant", "bar"],
  services: ["spa", "meeting", "steam"],
  guest_services: ["taxi", "shop", "other"],
  channel: false,
};
