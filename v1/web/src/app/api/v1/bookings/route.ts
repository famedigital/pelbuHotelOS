import {
  authenticateApiRequest,
  finishAudit,
  hashRequestBody,
  jsonError,
  jsonOk,
  loadIdempotency,
  readJsonBody,
  saveIdempotency,
} from "@/lib/website-api-http";
import {
  BookLibError,
  createBookingForProperty,
} from "@/lib/website-book";

const ALLOWED_FIELDS = new Set([
  "check_in",
  "check_out",
  "rooms",
  "adults",
  "children",
  "extra_beds",
  "contact_name",
  "contact_phone",
  "contact_email",
  "room_type_id",
  "room_type_code",
  "meal_plan_code",
  "promo_code",
  "notes",
  "quoted_total_btn",
  "mode",
  "external_ref",
  "channel_source",
]);

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  return v;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req, "bookings", {
    kind: "bookings",
  });
  if (!auth.ok) return auth.response;

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    await finishAudit(auth, req, 400);
    return jsonError(
      "VALIDATION",
      "Idempotency-Key header is required (8–128 characters).",
      400,
      auth.requestId,
      auth.cors,
    );
  }

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    await finishAudit(auth, req, 400);
    return jsonError("VALIDATION", parsed.error, 400, auth.requestId, auth.cors);
  }

  for (const key of Object.keys(parsed.body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      await finishAudit(auth, req, 400);
      return jsonError(
        "VALIDATION",
        `Unknown field: ${key}`,
        400,
        auth.requestId,
        auth.cors,
      );
    }
  }

  const requestHash = hashRequestBody(parsed.body);
  const existing = await loadIdempotency(auth.key.apiKeyId, idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      await finishAudit(auth, req, 409);
      return jsonError(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was reused with a different body.",
        409,
        auth.requestId,
        auth.cors,
      );
    }
    await finishAudit(auth, req, 200);
    return jsonOk(existing.responseJson, auth.requestId, 200, auth.cors);
  }

  const purpose = auth.key.purpose;
  const modeRaw = str(parsed.body.mode);
  let mode: "hold" | "confirmed" =
    purpose === "channel_manager" ? "confirmed" : "hold";
  if (modeRaw === "hold" || modeRaw === "confirmed") {
    mode = modeRaw;
  }

  try {
    const result = await createBookingForProperty(auth.key.propertyId, {
      checkIn: str(parsed.body.check_in) ?? "",
      checkOut: str(parsed.body.check_out) ?? "",
      rooms: num(parsed.body.rooms) ?? 1,
      adults: num(parsed.body.adults) ?? 2,
      children: num(parsed.body.children) ?? 0,
      extraBeds: num(parsed.body.extra_beds) ?? 0,
      contactName: str(parsed.body.contact_name) ?? "",
      contactPhone: str(parsed.body.contact_phone) ?? "",
      contactEmail: str(parsed.body.contact_email),
      roomTypeId: str(parsed.body.room_type_id),
      roomTypeCode: str(parsed.body.room_type_code),
      mealPlanCode: str(parsed.body.meal_plan_code),
      promoCode: str(parsed.body.promo_code),
      notes: str(parsed.body.notes),
      quotedTotalBtn: num(parsed.body.quoted_total_btn),
      mode,
      externalRef: str(parsed.body.external_ref),
      channelSource: str(parsed.body.channel_source),
    });

    const responseJson = {
      booking_id: result.bookingId,
      lookup_token: result.lookupToken,
      status: result.status,
      hold_expires_at: result.holdExpiresAt,
      payment_url: result.paymentUrl,
      token_amount_btn: result.tokenAmount,
      quoted_total_btn: result.quotedTotalBtn,
    };

    await saveIdempotency({
      apiKeyId: auth.key.apiKeyId,
      idempotencyKey,
      requestHash,
      responseJson,
      bookingId: result.bookingId,
    });

    await finishAudit(auth, req, 201);
    return jsonOk(responseJson, auth.requestId, 201, auth.cors);
  } catch (err) {
    if (err instanceof BookLibError) {
      const status =
        err.code === "SOLD_OUT" ||
        err.code === "QUOTE_MISMATCH" ||
        err.code === "DUPLICATE_EXTERNAL_REF"
          ? 409
          : err.code === "NOT_FOUND"
            ? 404
            : 400;
      await finishAudit(auth, req, status);
      return jsonError(err.code, err.message, status, auth.requestId, auth.cors);
    }
    await finishAudit(auth, req, 400);
    return jsonError(
      "VALIDATION",
      err instanceof Error ? err.message : "Could not create booking.",
      400,
      auth.requestId,
      auth.cors,
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
