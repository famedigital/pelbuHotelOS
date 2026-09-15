import {
  authenticateApiRequest,
  finishAudit,
  jsonError,
  jsonOk,
} from "@/lib/website-api-http";
import { getBookingForApi } from "@/lib/website-book";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(req, "bookings", {
    kind: "bookings",
  });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const lookupToken =
    url.searchParams.get("lookup_token")?.trim() ||
    req.headers.get("x-booking-lookup-token")?.trim() ||
    "";

  if (!lookupToken) {
    await finishAudit(auth, req, 404);
    return jsonError("NOT_FOUND", "Booking not found.", 404, auth.requestId, auth.cors);
  }

  const row = await getBookingForApi({
    propertyId: auth.key.propertyId,
    bookingId: id,
    lookupToken,
  });

  if (!row) {
    await finishAudit(auth, req, 404);
    return jsonError("NOT_FOUND", "Booking not found.", 404, auth.requestId, auth.cors);
  }

  await finishAudit(auth, req, 200);
  return jsonOk(
    {
      booking_id: row.bookingId,
      status: row.status,
      check_in: row.checkIn,
      check_out: row.checkOut,
      hold_expires_at: row.holdExpiresAt,
      quoted_total_btn: row.quotedTotalBtn,
      external_ref: row.externalRef,
      channel_source: row.channelSource,
    },
    auth.requestId,
    200,
    auth.cors,
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
