import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { createServiceClient } from "@hotel-os/db";
import { requireDeskJwt } from "./auth.js";
import type { AdapterCtx } from "./adapters/types.js";
import * as reservations from "./adapters/reservations.js";
import * as stayhub from "./adapters/stayhub.js";
import * as folio from "./adapters/folio.js";
import * as pos from "./adapters/pos.js";
import * as calendar from "./adapters/calendar.js";
import * as guests from "./adapters/guests.js";
import * as groups from "./adapters/groups.js";
import * as agents from "./adapters/agents.js";
import * as channel from "./adapters/channel.js";
import * as rateApprovals from "./adapters/rate-approvals.js";
import * as finance from "./adapters/finance.js";
import * as inventory from "./adapters/inventory.js";
import * as hr from "./adapters/hr.js";
import * as nightAudit from "./adapters/night-audit.js";
import * as hk from "./adapters/hk.js";
import * as settings from "./adapters/settings.js";
import * as bookingVerify from "./adapters/booking-verify.js";
import { deskCopilotDraft } from "./ai/desk-copilot.js";

function ctxFrom(jwt: Awaited<ReturnType<typeof requireDeskJwt>>): AdapterCtx {
  return { admin: createServiceClient(), jwt };
}

function errMsg(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

/** Map errors to HTTP: auth → 401, typed adapter errors keep their code, else 400. */
function fail(reply: FastifyReply, err: unknown) {
  const code = Number((err as { statusCode?: number } | null)?.statusCode);
  const status = Number.isInteger(code) && code >= 400 && code < 600 ? code : 400;
  return reply.code(status).send({ error: errMsg(err) });
}

export async function registerDomainRoutes(app: FastifyInstance) {
  // —— Reservations ——
  app.get("/v1/reservations", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as {
        view?: string;
        q?: string;
        from?: string;
        to?: string;
        limit?: string;
      };
      return await reservations.listReservations(ctxFrom(jwt), {
        view: q.view,
        q: q.q,
        from: q.from,
        to: q.to,
        limit: q.limit ? Number(q.limit) : undefined,
      });
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/reservations", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await reservations.createReservation(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/reservations/:id/cancel", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const { id } = req.params as { id: string };
      const body = req.body as { idempotencyKey?: string };
      return await reservations.cancelReservation(
        ctxFrom(jwt),
        id,
        body.idempotencyKey || crypto.randomUUID(),
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/reservations/:id/no-show", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const { id } = req.params as { id: string };
      const body = req.body as { idempotencyKey?: string };
      return await reservations.markNoShow(
        ctxFrom(jwt),
        id,
        body.idempotencyKey || crypto.randomUUID(),
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— StayHub ——
  app.get("/v1/stays/:id", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await stayhub.getStaySummary(
        ctxFrom(jwt),
        (req.params as { id: string }).id,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/stays/check-in", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await stayhub.checkInStay(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/stays/assign-room", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await stayhub.assignRoom(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/stays/rate", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await stayhub.updateStayRate(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/stays/checkout", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await stayhub.checkoutStay(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/room-types", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await reservations.listRoomTypes(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— Folio ——
  app.get("/v1/folio/:bookingId/balance", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await folio.getFolioBalance(
        ctxFrom(jwt),
        (req.params as { bookingId: string }).bookingId,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/folio/charge", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await folio.postFolioCharge(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/folio/payment", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await folio.postFolioPayment(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— Calendar / Day ——
  app.get("/v1/calendar/stayview", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { from?: string; nights?: string };
      return await calendar.getStayView(
        ctxFrom(jwt),
        q.from || "",
        q.nights ? Number(q.nights) : 14,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/desk/day", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { businessDate?: string };
      return await calendar.getDayBoard(ctxFrom(jwt), q.businessDate);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— Guests / Groups ——
  app.get("/v1/guests", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { q?: string; limit?: string };
      return await guests.searchGuests(
        ctxFrom(jwt),
        q.q || "",
        q.limit ? Number(q.limit) : 50,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/guests/:key", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await guests.getGuestDossier(
        ctxFrom(jwt),
        (req.params as { key: string }).key,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  /** Confirmation / voucher code lookup (matches `bookings.confirmation_code` for this property). */
  app.get("/v1/bookings/by-confirmation", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { code?: string };
      return await bookingVerify.getBookingByConfirmationCode(
        ctxFrom(jwt),
        q.code ?? "",
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/groups", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await groups.listParties(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/groups", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await groups.createParty(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— POS / KDS ——
  app.get("/v1/pos/menu", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await pos.listPosMenu(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/pos/orders", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await pos.createPosOrder(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/kds/tickets", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await pos.listKdsTickets(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/kds/status", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await pos.updateKotStatus(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— Agents / Channel / Rates ——
  app.get("/v1/agents", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await agents.listAgents(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/agents/:id", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await agents.getAgentDossier(
        ctxFrom(jwt),
        (req.params as { id: string }).id,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/channel/status", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await channel.getChannelStatus(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/rates/plans", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await channel.listRatePlans(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/rates/approvals", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await rateApprovals.listPendingRateApprovals(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/rates/approvals/:lineId/approve", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const { lineId } = req.params as { lineId: string };
      const body = (req.body ?? {}) as Record<string, unknown>;
      return await rateApprovals.approveRateRequest(ctxFrom(jwt), {
        ...body,
        lineId,
      });
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/rates/approvals/:lineId/reject", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const { lineId } = req.params as { lineId: string };
      const body = (req.body ?? {}) as Record<string, unknown>;
      return await rateApprovals.rejectRateRequest(ctxFrom(jwt), {
        ...body,
        lineId,
      });
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— Finance / Inventory / HR ——
  app.get("/v1/finance/hub", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await finance.getFinanceHub(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/finance/expenses", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { from?: string; to?: string };
      return await finance.listExpenses(ctxFrom(jwt), q.from, q.to);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/finance/expenses", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await finance.createExpense(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/finance/rrco", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { year?: string };
      return await finance.getRrcoBooks(
        ctxFrom(jwt),
        q.year ? Number(q.year) : undefined,
      );
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/inventory", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await inventory.listInventory(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/inventory/purchase-orders", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await inventory.createPurchaseOrder(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/hr/staff", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await hr.listStaff(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/hr/board", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await hr.getHrBoard(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/hr/payslips", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const q = req.query as { staffId?: string };
      return await hr.listPayslips(ctxFrom(jwt), q.staffId);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— Night audit ——
  app.get("/v1/night-audit/preview", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await nightAudit.getNightAuditPreview(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/night-audit/run", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await nightAudit.runNightAudit(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— HK / Settings / Loyalty / Laundry / Compliance ——
  app.get("/v1/hk/board", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await hk.getHkBoard(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/hk/status", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await hk.updateHkStatus(ctxFrom(jwt), req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/settings/property", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await settings.getPropertySettings(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/loyalty", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await settings.listLoyalty(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/compliance", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await settings.listCompliance(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/laundry", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      return await settings.listLaundry(ctxFrom(jwt));
    } catch (e) {
      return fail(reply, e);
    }
  });

  // —— BYOK Gemini desk copilot (draft only) ——
  app.post("/v1/ai/desk", async (req, reply) => {
    try {
      const jwt = await requireDeskJwt(req);
      const admin = createServiceClient();
      return await deskCopilotDraft(admin, jwt, req.body);
    } catch (e) {
      return fail(reply, e);
    }
  });
}
