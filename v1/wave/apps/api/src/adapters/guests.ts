import { z } from "zod";
import type { AdapterCtx } from "./types.js";

/**
 * Guest CRM. There is no `guests` table: guests are `booking_guests` (per stay,
 * with blacklist / desk notes) plus the booking contact on `bookings`.
 * Dossiers group by contact phone (fallback: name).
 */

/** Strip PostgREST filter metacharacters from user search input. */
export function safeSearchTerm(raw: string): string {
  return raw.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

type BookingRow = {
  id: string;
  confirmation_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  check_in: string;
  check_out: string;
  status: string;
};

export async function searchGuests(ctx: AdapterCtx, q: string, limit = 50) {
  const needle = safeSearchTerm(q);

  let bq = ctx.admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, contact_phone, contact_email, check_in, check_out, status",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .neq("status", "cancelled")
    .order("check_in", { ascending: false })
    .limit(500);
  if (needle) {
    bq = bq.or(
      `contact_name.ilike.%${needle}%,contact_phone.ilike.%${needle}%,contact_email.ilike.%${needle}%,confirmation_code.ilike.%${needle}%`,
    );
  }
  const { data: bookings, error } = await bq;
  if (error) throw error;

  // Also match named in-party guests (booking_guests) for this property.
  let extra: BookingRow[] = [];
  if (needle) {
    const { data: g, error: gErr } = await ctx.admin
      .from("booking_guests")
      .select(
        "id, full_name, bookings!inner(id, property_id, confirmation_code, contact_name, contact_phone, contact_email, check_in, check_out, status)",
      )
      .eq("bookings.property_id", ctx.jwt.propertyId)
      .ilike("full_name", `%${needle}%`)
      .limit(100);
    if (gErr) throw gErr;
    extra = (g ?? []).flatMap((row) => {
      const b = row.bookings as unknown as BookingRow | BookingRow[] | null;
      const bk = Array.isArray(b) ? b[0] : b;
      if (!bk || bk.status === "cancelled") return [];
      const overlay: BookingRow = {
        ...bk,
        contact_name: row.full_name as string,
        contact_phone: null,
      };
      return [overlay];
    });
  }

  const map = new Map<
    string,
    {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      stays: number;
      lastStay: string;
    }
  >();
  for (const b of [...((bookings ?? []) as BookingRow[]), ...extra]) {
    const phone = (b.contact_phone || "").trim();
    const key = phone || `name:${String(b.contact_name || "").toLowerCase()}`;
    const prev = map.get(key);
    if (prev) {
      prev.stays += 1;
      if (String(b.check_in) > prev.lastStay) prev.lastStay = String(b.check_in);
    } else {
      map.set(key, {
        id: key,
        name: String(b.contact_name || "Guest"),
        phone: b.contact_phone || null,
        email: b.contact_email || null,
        stays: 1,
        lastStay: String(b.check_in),
      });
    }
  }

  return {
    source: "bookings" as const,
    guests: [...map.values()]
      .sort((a, b) => b.lastStay.localeCompare(a.lastStay))
      .slice(0, limit),
  };
}

export async function getGuestDossier(ctx: AdapterCtx, guestKey: string) {
  const key = guestKey.trim();
  let q = ctx.admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, contact_phone, contact_email, status, check_in, check_out, quoted_total_btn, booking_guests(id, full_name, nationality, passport_or_cid, blacklisted, blacklist_reason, desk_notes)",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("check_in", { ascending: false })
    .limit(50);

  if (z.string().uuid().safeParse(key).success) {
    q = q.eq("id", key);
  } else if (key.startsWith("name:")) {
    q = q.ilike("contact_name", safeSearchTerm(key.slice(5)));
  } else {
    q = q.eq("contact_phone", key);
  }
  const { data, error } = await q;
  if (error) throw error;
  const stays = data ?? [];
  const blacklisted = stays.some((s) =>
    ((s.booking_guests ?? []) as Array<{ blacklisted?: boolean }>).some(
      (g) => g.blacklisted,
    ),
  );
  return { stays, blacklisted };
}
