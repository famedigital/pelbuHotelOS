import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cachedPublicByProperty, homeTag } from "@/lib/public-cache";
import {
  DEFAULT_LOGO_NAV_GAP_REM,
  DEFAULT_LOGO_NAV_OFFSET_PCT,
  DEFAULT_LOGO_NAV_SHIFT_X_REM,
  DEFAULT_LOGO_NAV_SIZE_REM,
  clampLogoShiftX,
} from "@/lib/property-settings";

export type PublicPropertyProfile = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  /** Cloudinary public_id from Settings → Identity; drives public-site brand logo. */
  logoPublicId: string | null;
  /** Header logo size in rem (desktop). */
  logoNavSizeRem: number;
  /** Header logo vertical hang (translateY %). */
  logoNavOffsetPct: number;
  /** Space between logo and hotel name (rem). */
  logoNavGapRem: number;
  /** Horizontal nudge of header mark (rem). */
  logoNavShiftXRem: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  starRating: number | null;
  roomCount: number | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
};

/** Instagram is stored as a handle; render it as a profile URL. */
function instagramUrl(handle: string | null): string | null {
  if (!handle) return null;
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;
  return clean.startsWith("http")
    ? clean
    : `https://instagram.com/${encodeURIComponent(clean)}`;
}

/** "14:00:00" / "14:00" → "14:00" for guest copy. */
export function formatClockTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = match[1].padStart(2, "0");
  return `${hours}:${match[2]}`;
}

/** Public NAP + verified facts only — never invent phone or prices. */
const STANDARD_CHECK_IN = "14:00";
const STANDARD_CHECK_OUT = "12:00";
const FLAGSHIP_AMENITIES = [
  "On-site parking",
  "Restaurant",
  "Cafe & pastry",
  "Spa & steam",
  "Meeting room",
  "Free Wi-Fi",
  "Guide & driver beds (agent groups)",
];

function amenitiesList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? name.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

/** Public NAP + verified facts — never invent phone, star, or prices. */
export const loadPublicPropertyProfile = cache(
  async (): Promise<PublicPropertyProfile | null> => {
    return cachedPublicByProperty(
      ["public-property-profile"],
      homeTag,
      async (propertyId) => {
        const admin = createSupabaseAdminClient();

        const [{ data }, { data: facts }] = await Promise.all([
          admin
            .from("properties")
            .select(
              "name, phone, email, address, whatsapp, maps_url, instagram_handle, facebook_url, tiktok_url, logo_public_id, logo_nav_size_rem, logo_nav_offset_pct, logo_nav_gap_rem, logo_nav_shift_x_rem",
            )
            .eq("id", propertyId)
            .maybeSingle(),
          admin
            .from("property_facts")
            .select(
              "check_in_time, check_out_time, star_rating, room_count, latitude, longitude, amenities_json",
            )
            .eq("property_id", propertyId)
            .maybeSingle(),
        ]);

        if (!data) return null;

        const phone = (data.phone as string | null) ?? null;
        const whatsappRaw = (data.whatsapp as string | null) ?? null;
        const whatsapp = whatsappRaw?.trim() || phone;
        const amenities = amenitiesList(facts?.amenities_json);
        const sizeRaw = Number(data.logo_nav_size_rem);
        const offsetRaw = Number(data.logo_nav_offset_pct);
        const gapRaw = Number(data.logo_nav_gap_rem);
        const shiftRaw = Number(data.logo_nav_shift_x_rem);

        return {
          name: (data.name as string) || "Pelbu Suites",
          phone,
          email: (data.email as string | null) ?? null,
          address: (data.address as string | null) ?? null,
          whatsapp,
          mapsUrl: (data.maps_url as string | null) ?? null,
          instagram: instagramUrl(
            (data.instagram_handle as string | null) ?? null,
          ),
          facebook: (data.facebook_url as string | null) ?? null,
          tiktok: (data.tiktok_url as string | null) ?? null,
          logoPublicId: (data.logo_public_id as string | null) ?? null,
          logoNavSizeRem: Number.isFinite(sizeRaw)
            ? Math.min(12, Math.max(4, sizeRaw))
            : DEFAULT_LOGO_NAV_SIZE_REM,
          logoNavOffsetPct: Number.isFinite(offsetRaw)
            ? Math.min(70, Math.max(20, offsetRaw))
            : DEFAULT_LOGO_NAV_OFFSET_PCT,
          logoNavGapRem: Number.isFinite(gapRaw)
            ? Math.min(3, Math.max(0, Math.round(gapRaw * 100) / 100))
            : DEFAULT_LOGO_NAV_GAP_REM,
          logoNavShiftXRem: Number.isFinite(shiftRaw)
            ? clampLogoShiftX(shiftRaw)
            : DEFAULT_LOGO_NAV_SHIFT_X_REM,
          checkInTime:
            formatClockTime(
              (facts?.check_in_time as string | null | undefined) ?? null,
            ) ?? STANDARD_CHECK_IN,
          checkOutTime:
            formatClockTime(
              (facts?.check_out_time as string | null | undefined) ?? null,
            ) ?? STANDARD_CHECK_OUT,
          starRating:
            facts?.star_rating != null &&
            Number.isFinite(Number(facts.star_rating))
              ? Number(facts.star_rating)
              : null,
          roomCount:
            facts?.room_count != null &&
            Number.isFinite(Number(facts.room_count))
              ? Number(facts.room_count)
              : null,
          latitude:
            facts?.latitude != null && Number.isFinite(Number(facts.latitude))
              ? Number(facts.latitude)
              : null,
          longitude:
            facts?.longitude != null &&
            Number.isFinite(Number(facts.longitude))
              ? Number(facts.longitude)
              : null,
          amenities: amenities.length ? amenities : FLAGSHIP_AMENITIES,
        };
      },
      null,
    );
  },
);
