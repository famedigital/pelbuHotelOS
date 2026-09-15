import {
  authenticateApiRequest,
  finishAudit,
  jsonError,
  jsonOk,
} from "@/lib/website-api-http";
import { BookLibError, buildAriWindow } from "@/lib/website-book";

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, "ari", { kind: "ari" });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const roomTypeCode = url.searchParams.get("room_type_code");

    const ari = await buildAriWindow(
      auth.key.propertyId,
      from,
      to,
      roomTypeCode,
    );

    const body = {
      from: ari.from,
      to: ari.to,
      currency: ari.currency,
      room_types: ari.roomTypes.map((rt) => ({
        room_type_id: rt.roomTypeId,
        code: rt.code,
        name: rt.name,
        days: rt.days.map((d) => ({
          date: d.date,
          availability: d.availability,
          rate_btn: d.rateBtn,
          stop_sell: d.stopSell,
        })),
      })),
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
