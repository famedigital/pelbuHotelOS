import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createServiceClient } from "@hotel-os/db";
import { requireDeskJwt } from "./auth.js";

export async function registerHardwareFxRoutes(app: FastifyInstance) {
  app.post("/v1/hardware/keycard", async (req) => {
    await requireDeskJwt(req);
    const body = z
      .object({
        roomNumber: z.string(),
        checkInIso: z.string(),
        checkOutIso: z.string(),
        guestName: z.string(),
      })
      .parse(req.body);
    const encoderHost = process.env.RFID_ENCODER_HOST?.trim();
    const simulated = !encoderHost;
    return {
      ok: true as const,
      encoderId: simulated ? "simulated-encoder" : encoderHost,
      encoded: body,
      mode: simulated ? "simulated" : "env_configured",
      // Physical encode is not implemented — card is never written in either mode.
      encodedCard: false,
      message: simulated
        ? "Simulated mode: RFID_ENCODER_HOST unset; no hardware encoded."
        : "RFID_ENCODER_HOST is set but the encoder bridge is not implemented; card not encoded.",
    };
  });

  app.get("/v1/fx/rates", async (req) => {
    await requireDeskJwt(req);
    const admin = createServiceClient();
    const { data } = await admin
      .from("rma_fx_rates")
      .select("*")
      .order("as_of", { ascending: false })
      .limit(20);
    return { rates: data ?? [] };
  });

  app.post("/v1/fx/sync", async (req, reply) => {
    await requireDeskJwt(req);
    // The previous version wrote hard-coded placeholder rates tagged
    // source="rma_sync_job". Fake FX in a money system is worse than none:
    // refuse until a real RMA feed (or manual entry with audit) is wired.
    return reply.code(501).send({
      error: "RMA FX feed is not wired yet — enter rates manually in Innora finance.",
    });
  });

  app.get("/v1/owner/pulse", async (req) => {
    const jwt = await requireDeskJwt(req);
    const admin = createServiceClient();
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Thimphu",
    });
    const { data: shift } = await admin
      .from("cash_till_shifts")
      .select("*")
      .eq("property_id", jwt.propertyId)
      .eq("status", "open")
      .maybeSingle();
    const { count: inHouse } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("property_id", jwt.propertyId)
      .eq("status", "checked_in");
    const expected =
      Number(shift?.opening_balance_btn ?? 0) +
      Number(shift?.collected_cash_btn ?? 0) -
      Number(shift?.petty_cash_outflow_btn ?? 0);
    return {
      propertyId: jwt.propertyId,
      asOf: today,
      inHouse: inHouse ?? 0,
      tillExpectedBtn: expected,
      tillShiftId: shift?.id ?? null,
    };
  });
}
