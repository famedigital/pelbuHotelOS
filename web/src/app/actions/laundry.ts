"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import {
  clearLaundrySession,
  createLaundryToken,
  getLaundryGuestSession,
  hashLaundryToken,
  setLaundrySessionCookie,
} from "@/lib/laundry-session";
import { autoPrepareDefaultBag } from "@/lib/laundry/prepare-default-bag";
import {
  isLaundryPhotoId,
  normalizeGuestName,
  type LaundryCatalogItem,
  type LaundryOrder,
} from "@/lib/laundry";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { calculateOrderTotals, roundBtn } from "@/lib/pricing";
import { absoluteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";

export type LaundryGuestState = {
  ok: boolean;
  orderId?: string;
  payUrl?: string;
  estimatedTotalBtn?: number;
  error?: string;
};

type IntakeLine = { catalogItemId: string; qty: number };

function genericValidationError() {
  return new Error(
    "We could not verify those details. Check the guest name and room number, or call reception.",
  );
}

async function attemptKey(room: string): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const agent = h.get("user-agent") ?? "";
  const pepper = process.env.LAUNDRY_ACCESS_PEPPER ?? "pelbu-laundry";
  return createHash("sha256")
    .update(`${pepper}|${forwarded}|${agent.slice(0, 80)}|${room.toLowerCase()}`)
    .digest("hex");
}

export async function validateLaundryGuest(
  _prev: LaundryGuestState,
  formData: FormData,
): Promise<LaundryGuestState> {
  try {
    const guestName = trimRequired(formData.get("guest_name"), "Guest name");
    const roomLabel = trimRequired(formData.get("room_label"), "Room number");
    if (guestName.length > 100 || roomLabel.length > 30) {
      throw genericValidationError();
    }
    const identifierHash = await attemptKey(roomLabel);
    const admin = createSupabaseAdminClient();
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await admin
      .from("laundry_access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier_hash", identifierHash)
      .eq("success", false)
      .gte("attempted_at", since);
    if ((count ?? 0) >= 5) {
      throw new Error("Too many attempts. Wait 15 minutes or call reception.");
    }

    const { data: property } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .maybeSingle();
    if (!property) throw new Error("Laundry service is not configured.");
    const { data: room } = await admin
      .from("room_units")
      .select("id, label")
      .eq("property_id", property.id)
      .ilike("label", roomLabel.trim())
      .maybeSingle();
    if (!room) {
      await admin
        .from("laundry_access_attempts")
        .insert({ identifier_hash: identifierHash, success: false });
      throw genericValidationError();
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Thimphu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const { data: assignments } = await admin
      .from("room_assignments")
      .select(
        "id, booking_id, bookings!inner(id, contact_name, check_out, status, booking_guests(id, full_name, room_assignment_id))",
      )
      .eq("property_id", property.id)
      .eq("room_unit_id", room.id)
      .lte("from_date", today)
      .gt("to_date", today)
      .eq("bookings.status", "checked_in");

    const normalized = normalizeGuestName(guestName);
    let matched:
      | {
          bookingId: string;
          checkout: string;
          canonicalName: string;
        }
      | undefined;
    for (const assignment of assignments ?? []) {
      const bookingRaw = Array.isArray(assignment.bookings)
        ? assignment.bookings[0]
        : assignment.bookings;
      const booking = bookingRaw as
        | {
            id: string;
            contact_name: string | null;
            check_out: string;
            booking_guests:
              | {
                  id: string;
                  full_name: string;
                  room_assignment_id: string | null;
                }[]
              | null;
          }
        | null;
      if (!booking) continue;
      const candidates = [
        booking.contact_name,
        ...(booking.booking_guests ?? [])
          .filter(
            (guest) =>
              !guest.room_assignment_id ||
              guest.room_assignment_id === (assignment.id as string),
          )
          .map((guest) => guest.full_name),
      ].filter((value): value is string => Boolean(value));
      const canonical = candidates.find(
        (candidate) => normalizeGuestName(candidate) === normalized,
      );
      if (canonical) {
        matched = {
          bookingId: booking.id,
          checkout: booking.check_out,
          canonicalName: canonical,
        };
        break;
      }
    }

    await admin.from("laundry_access_attempts").insert({
      identifier_hash: identifierHash,
      success: Boolean(matched),
    });
    if (!matched) throw genericValidationError();

    const token = createLaundryToken();
    const checkoutAt = new Date(`${matched.checkout}T12:00:00+06:00`);
    const expiresAt = new Date(
      Math.min(Date.now() + 24 * 60 * 60_000, checkoutAt.getTime()),
    );
    const { error } = await admin.from("laundry_guest_sessions").insert({
      token_hash: hashLaundryToken(token),
      property_id: property.id,
      booking_id: matched.bookingId,
      room_unit_id: room.id,
      guest_name: matched.canonicalName,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error("Could not start a secure laundry session.");
    await setLaundrySessionCookie(token, expiresAt);
    revalidatePath("/laundry");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not verify your stay.",
    };
  }
}

function parseLines(value: FormDataEntryValue | null): IntakeLine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value ?? "[]"));
  } catch {
    throw new Error("Laundry item list is invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("Add at least one garment.");
  const merged = new Map<string, number>();
  for (const row of parsed) {
    const id =
      row && typeof row === "object" && "catalogItemId" in row
        ? String(row.catalogItemId)
        : "";
    const qty =
      row && typeof row === "object" && "qty" in row
        ? Number(row.qty)
        : 0;
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 100) continue;
    merged.set(id, Math.min(200, (merged.get(id) ?? 0) + qty));
  }
  const lines = [...merged].map(([catalogItemId, qty]) => ({
    catalogItemId,
    qty,
  }));
  if (lines.length === 0) throw new Error("Add at least one garment.");
  return lines;
}

function parsePhotoIds(
  value: FormDataEntryValue | null,
  propertyId: string,
): string[] {
  let ids: unknown = [];
  try {
    ids = JSON.parse(String(value ?? "[]"));
  } catch {
    throw new Error("Photo reference is invalid.");
  }
  if (!Array.isArray(ids)) return [];
  return ids
    .map(String)
    .filter((id) => isLaundryPhotoId(id, propertyId))
    .slice(0, 4);
}

export async function submitGuestLaundry(
  _prev: LaundryGuestState,
  formData: FormData,
): Promise<LaundryGuestState> {
  try {
    const session = await getLaundryGuestSession();
    if (!session) throw new Error("Your secure session expired. Verify again.");
    const lines = parseLines(formData.get("items"));
    const notes = optionalTrim(formData.get("notes"));
    const photos = parsePhotoIds(
      formData.get("photo_public_ids"),
      session.propertyId,
    );
    const admin = createSupabaseAdminClient();
    const ids = lines.map((line) => line.catalogItemId);
    const { data: catalog } = await admin
      .from("laundry_catalog_items")
      .select("id, name, unit_label")
      .eq("property_id", session.propertyId)
      .eq("is_active", true)
      .in("id", ids);
    if (!catalog || catalog.length !== ids.length) {
      throw new Error("One or more laundry services are unavailable.");
    }
    const { data: room } = await admin
      .from("room_units")
      .select("label")
      .eq("id", session.roomUnitId)
      .single();
    const { data: order, error } = await admin
      .from("laundry_orders")
      .insert({
        property_id: session.propertyId,
        booking_id: session.bookingId,
        room_unit_id: session.roomUnitId,
        guest_name: session.guestName,
        room_label_snapshot: (room?.label as string) ?? "Room",
        source: "guest",
        requested_notes: notes,
        intake_photo_public_ids: photos,
      })
      .select("id")
      .single();
    if (error || !order) throw new Error("Could not submit laundry request.");
    const byId = new Map(catalog.map((row) => [row.id as string, row]));
    const { error: itemError } = await admin.from("laundry_order_items").insert(
      lines.map((line) => {
        const item = byId.get(line.catalogItemId);
        return {
          order_id: order.id,
          catalog_item_id: line.catalogItemId,
          name_snapshot: item?.name as string,
          unit_label_snapshot: item?.unit_label as string,
          requested_qty: line.qty,
        };
      }),
    );
    if (itemError) {
      await admin.from("laundry_orders").delete().eq("id", order.id);
      throw new Error("Could not save laundry items.");
    }
    await admin.from("laundry_order_events").insert({
      property_id: session.propertyId,
      order_id: order.id,
      event_type: "requested",
      to_status: "requested",
      notes,
      photo_public_ids: photos,
      actor_kind: "guest",
    });
    await autoPrepareDefaultBag(
      admin,
      session.propertyId,
      order.id as string,
      "front_desk",
    );
    revalidatePath("/laundry");
    revalidatePath("/erp/laundry");
    revalidatePath("/staff/laundry");
    return { ok: true, orderId: order.id as string };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not submit laundry request.",
    };
  }
}

export async function logoutLaundryGuest(): Promise<void> {
  await clearLaundrySession();
  revalidatePath("/laundry");
}

export async function loadGuestLaundryData(): Promise<{
  session: Awaited<ReturnType<typeof getLaundryGuestSession>>;
  catalog: LaundryCatalogItem[];
  orders: LaundryOrder[];
}> {
  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .maybeSingle();
  if (!property) return { session: null, catalog: [], orders: [] };

  const session = await getLaundryGuestSession();
  const catalogQuery = admin
    .from("laundry_catalog_items")
    .select(
      "id, name, category, unit_label, price_btn, gst_applicable, turnaround_hours, is_active, sort_order",
    )
    .eq("property_id", property.id)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (!session) {
    const { data: catalog } = await catalogQuery;
    return {
      session: null,
      catalog: (catalog ?? []).map((row) => ({
        ...row,
        price_btn: Number(row.price_btn),
        turnaround_hours: Number(row.turnaround_hours),
      })) as LaundryCatalogItem[],
      orders: [],
    };
  }

  const [{ data: catalog }, { data: orders }] = await Promise.all([
    catalogQuery,
    admin
      .from("laundry_orders")
      .select(
        "id, booking_id, room_unit_id, guest_name, room_label_snapshot, source, status, assigned_staff_id, requested_notes, condition_notes, exception_notes, intake_photo_public_ids, completion_photo_public_ids, total_btn, requested_at, received_at, ready_at, delivered_at, billed_at, laundry_order_items(id, catalog_item_id, name_snapshot, unit_label_snapshot, requested_qty, confirmed_qty, unit_price_btn, line_total_btn)",
      )
      .eq("booking_id", session.bookingId)
      .eq("room_unit_id", session.roomUnitId)
      .order("requested_at", { ascending: false })
      .limit(20),
  ]);
  return {
    session,
    catalog: (catalog ?? []).map((row) => ({
      ...row,
      price_btn: Number(row.price_btn),
      turnaround_hours: Number(row.turnaround_hours),
    })) as LaundryCatalogItem[],
    orders: (orders ?? []).map((row) => ({
      ...row,
      total_btn: row.total_btn == null ? null : Number(row.total_btn),
      intake_photo_public_ids:
        (row.intake_photo_public_ids as string[] | null) ?? [],
      completion_photo_public_ids:
        (row.completion_photo_public_ids as string[] | null) ?? [],
      laundry_order_items: (
        (row.laundry_order_items as LaundryOrder["laundry_order_items"]) ?? []
      ).map((item) => ({
        ...item,
        unit_price_btn:
          item.unit_price_btn == null ? null : Number(item.unit_price_btn),
        line_total_btn:
          item.line_total_btn == null ? null : Number(item.line_total_btn),
      })),
    })) as LaundryOrder[],
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export async function submitPublicWalkInLaundry(
  _prev: LaundryGuestState,
  formData: FormData,
): Promise<LaundryGuestState> {
  try {
    const guestName = trimRequired(formData.get("guest_name"), "Your name");
    const guestPhone = normalizePhone(
      trimRequired(formData.get("guest_phone"), "Mobile number"),
    );
    if (guestName.length > 100) {
      throw new Error("Name is too long.");
    }
    if (guestPhone.length < 8 || guestPhone.length > 20) {
      throw new Error("Enter a valid mobile number.");
    }
    const roomHint = optionalTrim(formData.get("room_hint"))?.slice(0, 30);
    const lines = parseLines(formData.get("items"));
    const notes = optionalTrim(formData.get("notes"));

    const admin = createSupabaseAdminClient();
    const { data: property } = await admin
      .from("properties")
      .select(
        "id, gst_rate, service_charge_rate, service_charge_default_on, bank_accounts",
      )
      .eq("slug", PELBU_PROPERTY_SLUG)
      .maybeSingle();
    if (!property) throw new Error("Laundry service is not configured.");

    const propertyId = property.id as string;
    const validPhotos = parsePhotoIds(
      formData.get("photo_public_ids"),
      propertyId,
    );
    const ids = lines.map((line) => line.catalogItemId);
    const { data: catalog } = await admin
      .from("laundry_catalog_items")
      .select("id, name, unit_label, price_btn, gst_applicable")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .in("id", ids);
    if (!catalog || catalog.length !== ids.length) {
      throw new Error("One or more laundry services are unavailable.");
    }
    const byId = new Map(catalog.map((row) => [row.id as string, row]));
    const pricingLines = lines.map((line) => {
      const item = byId.get(line.catalogItemId)!;
      return {
        qty: line.qty,
        unitPriceBtn: Number(item.price_btn),
        gstApplicable: Boolean(item.gst_applicable),
      };
    });
    const totals = calculateOrderTotals(pricingLines, {
      gstRate: Number(property.gst_rate ?? 0.07),
      serviceChargeRate: Number(property.service_charge_rate ?? 0),
      applyServiceCharge: Boolean(property.service_charge_default_on),
    });
    if (totals.totalBtn <= 0) {
      throw new Error("Order total must be greater than zero.");
    }

    const { data: order, error: orderError } = await admin
      .from("laundry_orders")
      .insert({
        property_id: propertyId,
        booking_id: null,
        room_unit_id: null,
        guest_name: guestName,
        guest_phone: guestPhone,
        room_label_snapshot: roomHint || "Walk-in",
        source: "walk_in",
        requested_notes: notes,
        intake_photo_public_ids: validPhotos,
        subtotal_btn: totals.subtotalBtn,
        service_charge_btn: totals.serviceChargeBtn,
        gst_btn: totals.gstBtn,
        total_btn: totals.totalBtn,
      })
      .select("id")
      .single();
    if (orderError || !order) {
      throw new Error("Could not submit laundry request.");
    }

    const { error: itemError } = await admin.from("laundry_order_items").insert(
      lines.map((line) => {
        const item = byId.get(line.catalogItemId)!;
        return {
          order_id: order.id,
          catalog_item_id: line.catalogItemId,
          name_snapshot: item.name as string,
          unit_label_snapshot: item.unit_label as string,
          requested_qty: line.qty,
        };
      }),
    );
    if (itemError) {
      await admin.from("laundry_orders").delete().eq("id", order.id);
      throw new Error("Could not save laundry items.");
    }

    const banks =
      (property.bank_accounts as { hint?: string }[] | null) ?? [];
    const bankHint =
      banks.find((b) => b.hint)?.hint ??
      "BoB / BNB / TBank / DrukPNB — quote laundry ref in remarks";
    const token = createHash("sha256")
      .update(randomBytes(24))
      .digest("hex")
      .slice(0, 24);
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);

    const { data: link, error: linkError } = await admin
      .from("payment_links")
      .insert({
        property_id: propertyId,
        token,
        amount_btn: roundBtn(totals.totalBtn),
        purpose: "balance",
        payee_name: guestName,
        payee_phone: guestPhone,
        bank_hint: bankHint,
        expires_at: expires.toISOString(),
        notes: `Laundry walk-in · order ${String(order.id).slice(0, 8).toUpperCase()}`,
        status: "open",
      })
      .select("id, token")
      .single();
    if (linkError || !link) {
      await admin.from("laundry_orders").delete().eq("id", order.id);
      throw new Error("Could not create payment link.");
    }

    await admin
      .from("laundry_orders")
      .update({ payment_link_id: link.id })
      .eq("id", order.id);

    await admin.from("laundry_order_events").insert({
      property_id: propertyId,
      order_id: order.id,
      event_type: "requested",
      to_status: "requested",
      notes: notes ?? "Public walk-in intake",
      photo_public_ids: validPhotos,
      actor_kind: "guest",
    });

    await autoPrepareDefaultBag(admin, propertyId, order.id as string, "front_desk");

    revalidatePath("/laundry");
    revalidatePath("/erp/laundry");
    revalidatePath("/staff/laundry");

    return {
      ok: true,
      orderId: order.id as string,
      payUrl: absoluteUrl(`/pay/${link.token as string}`),
      estimatedTotalBtn: totals.totalBtn,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not submit laundry request.",
    };
  }
}
