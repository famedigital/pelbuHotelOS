import {
  authenticateApiRequest,
  finishAudit,
  jsonError,
  jsonOk,
} from "@/lib/website-api-http";
import { BookLibError, previewStayForProperty } from "@/lib/website-book";

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, "availability", {
    kind: "availability",
  });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const checkIn = url.searchParams.get("check_in") ?? "";
    const checkOut = url.searchParams.get("check_out") ?? "";
    const rooms = Number(url.searchParams.get("rooms") ?? "1");
    const adults = Number(url.searchParams.get("adults") ?? "2");

    const preview = await previewStayForProperty(auth.key.propertyId, {
      checkIn,
      checkOut,
      rooms,
      adults,
    });

    const body = {
      check_in: preview.checkIn,
      check_out: preview.checkOut,
      nights: preview.nights,
      season: preview.season,
      currency: preview.currency,
      rooms: preview.rooms,
      rates_inclusive_of_gst_sc: preview.ratesInclusiveOfGstSc,
      options: preview.options.map((o) => ({
        room_type_id: o.roomTypeId,
        code: o.code,
        name: o.name,
        capacity: o.capacity,
        remaining: o.remaining,
        per_night_btn: o.perNightBtn,
        total_btn: o.totalBtn,
        available: o.available,
      })),
      meal_plans: preview.mealPlans.map((m) => ({
        code: m.code,
        name: m.name,
        blurb: m.blurb,
        amount_per_adult_night: m.amountPerAdultNight,
        amount_per_child_night: m.amountPerChildNight,
        priced: m.priced,
      })),
      extra_bed: {
        sellable: preview.extraBed.sellable,
        rate_per_night: preview.extraBed.ratePerNight,
        max_qty: preview.extraBed.maxQty,
      },
    };

    await finishAudit(auth, req, 200);
    return jsonOk(body, auth.requestId, 200, auth.cors);
  } catch (err) {
    if (err instanceof BookLibError) {
      await finishAudit(auth, req, 400);
      return jsonError(err.code, err.message, 400, auth.requestId, auth.cors);
    }
    await finishAudit(auth, req, 400);
    return jsonError(
      "VALIDATION",
      err instanceof Error ? err.message : "Invalid request.",
      400,
      auth.requestId,
      auth.cors,
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
