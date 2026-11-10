import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createServiceClient } from "@hotel-os/db";
import { requireDeskJwt, type DeskJwt } from "./auth.js";

const MONEY_OPS = new Set([
  "post_charge",
  "record_payment",
  "record_expense",
  "night_audit",
  "check_out",
  "create_pos_order",
  "fire_kot",
]);

const walSchema = z.object({
  opId: z.string().min(1),
  opType: z.enum([
    "check_in",
    "check_out",
    "shift_room",
    "post_charge",
    "record_expense",
    "record_payment",
    "housekeeping",
    "night_audit",
    "create_reservation",
    "cancel_reservation",
    "create_pos_order",
    "fire_kot",
    "update_kot",
    "assign_room",
  ]),
  payload: z.record(z.unknown()),
  timestamp: z.string(),
  idempotencyKey: z.string().uuid(),
  status: z.string().optional(),
});

async function alreadyProcessed(
  admin: ReturnType<typeof createServiceClient>,
  propertyId: string,
  key: string,
): Promise<unknown | null> {
  const { data, error } = await admin
    .from("idempotency_keys")
    .select("response")
    .eq("property_id", propertyId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) {
    console.error("[sync-replay] idempotency load failed", error);
  }
  return data?.response ?? null;
}

async function saveIdempotency(
  admin: ReturnType<typeof createServiceClient>,
  propertyId: string,
  key: string,
  op: string,
  response: Record<string, unknown>,
) {
  const { error } = await admin.from("idempotency_keys").upsert(
    {
      property_id: propertyId,
      idempotency_key: key,
      operation: op,
      response,
    },
    { onConflict: "property_id,idempotency_key" },
  );
  if (error) {
    console.error("[sync-replay] idempotency save failed", error);
  }
}

/**
 * Offline WAL replay accepts ONLY ops that are safe to apply late and carry no
 * money: check-in (via check_in_guest_atomic) and housekeeping status.
 * Money ops (charges, payments, expenses, checkout, POS/KOT, night audit) and
 * room moves must go through the online adapter routes, which apply property
 * tax settings, room-block/lock checks and ledger rules. Anything else is
 * rejected — never silently acked (an ack tells the client its draft is saved).
 */
const REPLAYABLE_OPS = new Set(["check_in", "housekeeping"]);

class ReplayRejected extends Error {
  readonly statusCode = 422;
}

async function replayOp(
  jwt: DeskJwt,
  entry: z.infer<typeof walSchema>,
): Promise<Record<string, unknown>> {
  if (!REPLAYABLE_OPS.has(entry.opType)) {
    throw new ReplayRejected(
      MONEY_OPS.has(entry.opType)
        ? `${entry.opType} is a money op — post it through the online desk API, not offline replay`
        : `${entry.opType} is not supported by offline replay — use the online desk API`,
    );
  }

  const admin = createServiceClient();
  const cached = await alreadyProcessed(
    admin,
    jwt.propertyId,
    entry.idempotencyKey,
  );
  if (cached) return { ...(cached as object), replayed: true };

  let result: Record<string, unknown>;

  switch (entry.opType) {
    case "check_in": {
      const stayId = z.string().uuid().parse(entry.payload.stayId);
      const roomId = entry.payload.assignedRoomId
        ? z.string().uuid().parse(entry.payload.assignedRoomId)
        : null;
      const { data: rpc, error } = await admin.rpc("check_in_guest_atomic", {
        p_property_id: jwt.propertyId,
        p_booking_id: stayId,
        p_idempotency_key: entry.idempotencyKey,
        p_room_unit_id: roomId,
      });
      if (error) {
        console.error("[sync-replay] check_in_guest_atomic failed", error);
        throw new Error(error.message ?? "check_in_guest_atomic failed");
      }
      result = { ok: true, stayId, status: "checked_in", rpc };
      break;
    }
    case "housekeeping": {
      const roomId = z.string().uuid().parse(entry.payload.roomId);
      const status = String(entry.payload.status);
      // room_units.hk_status CHECK: clean | dirty | inspect | ooo | occupied
      const map: Record<string, string> = {
        clean: "clean",
        dirty: "dirty",
        inspect: "inspect",
        inspected: "inspect",
        ooo: "ooo",
        maintenance: "ooo",
      };
      const hk = map[status];
      if (!hk) throw new ReplayRejected(`Unknown housekeeping status: ${status}`);
      const { data: unit, error: uErr } = await admin
        .from("room_units")
        .select("id, hk_status")
        .eq("id", roomId)
        .eq("property_id", jwt.propertyId)
        .maybeSingle();
      if (uErr) throw uErr;
      if (!unit) throw new ReplayRejected("Room not found for property");
      if (unit.hk_status === "occupied") {
        throw new ReplayRejected("Room is occupied — status changes at checkout");
      }
      const { error } = await admin
        .from("room_units")
        .update({ hk_status: hk, updated_at: new Date().toISOString() })
        .eq("id", roomId)
        .eq("property_id", jwt.propertyId);
      if (error) throw error;
      result = { ok: true, roomId, hk_status: hk };
      break;
    }
    default:
      throw new ReplayRejected(`${entry.opType} is not replayable`);
  }

  await saveIdempotency(
    admin,
    jwt.propertyId,
    entry.idempotencyKey,
    entry.opType,
    result,
  );
  return result;
}

export async function registerSyncRoutes(app: FastifyInstance) {
  app.post("/v1/sync/replay", async (req, reply) => {
    const jwt = await requireDeskJwt(req);
    const parsed = walSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const result = await replayOp(jwt, parsed.data);
      return { opId: parsed.data.opId, ...result };
    } catch (err) {
      req.log.error(err);
      const code =
        err instanceof ReplayRejected
          ? 422
          : err instanceof z.ZodError
            ? 400
            : 500;
      return reply.code(code).send({
        error: err instanceof Error ? err.message : String(err),
        opId: parsed.data.opId,
      });
    }
  });
}
