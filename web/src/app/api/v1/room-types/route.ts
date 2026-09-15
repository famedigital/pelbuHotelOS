import {
  authenticateApiRequest,
  finishAudit,
  jsonError,
  jsonOk,
} from "@/lib/website-api-http";
import { listSellableRoomTypes } from "@/lib/website-book";

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, "availability", {
    kind: "availability",
  });
  if (!auth.ok) return auth.response;

  const rows = await listSellableRoomTypes(auth.key.propertyId);
  await finishAudit(auth, req, 200);
  return jsonOk(
    {
      room_types: rows.map((r) => ({
        room_type_id: r.roomTypeId,
        code: r.code,
        name: r.name,
        unit_count: r.unitCount,
      })),
    },
    auth.requestId,
    200,
    auth.cors,
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
