import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cloudinaryConfigured, createUploadTicket } from "@/lib/cloudinary-upload";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { getLaundryGuestSession } from "@/lib/laundry-session";
import { resolveActivePropertyId } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Photo upload is not configured." },
      { status: 503 },
    );
  }
  let body: { bookingId?: string; orderId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Context is optional for an authenticated guest.
  }

  const admin = createSupabaseAdminClient();
  const guest = await getLaundryGuestSession();
  let propertyId = guest?.propertyId ?? null;
  let bookingId = guest?.bookingId ?? null;

  if (!guest) {
    const staff = await getStaffSession();
    if (staff) {
      propertyId = staff.propertyId;
      if (body.orderId) {
        const { data: order } = await admin
          .from("laundry_orders")
          .select("booking_id")
          .eq("id", body.orderId)
          .eq("property_id", staff.propertyId)
          .maybeSingle();
        bookingId = (order?.booking_id as string | undefined) ?? null;
      } else if (body.bookingId) {
        const { data: booking } = await admin
          .from("bookings")
          .select("id")
          .eq("id", body.bookingId)
          .eq("property_id", staff.propertyId)
          .maybeSingle();
        bookingId = (booking?.id as string | undefined) ?? null;
      }
    } else if (await isDeskAuthenticated()) {
      propertyId = await resolveActivePropertyId(admin);
      if (body.bookingId) {
        const { data: booking } = await admin
          .from("bookings")
          .select("id")
          .eq("id", body.bookingId)
          .eq("property_id", propertyId)
          .maybeSingle();
        bookingId = (booking?.id as string | undefined) ?? null;
      } else if (body.orderId) {
        const { data: order } = await admin
          .from("laundry_orders")
          .select("booking_id")
          .eq("id", body.orderId)
          .eq("property_id", propertyId)
          .maybeSingle();
        bookingId = (order?.booking_id as string | undefined) ?? null;
      }
    }
  }

  if (!propertyId || !bookingId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const folder = `pelbu/laundry/${propertyId}/${bookingId}/${randomUUID()}`;
  return NextResponse.json(createUploadTicket(folder));
}
