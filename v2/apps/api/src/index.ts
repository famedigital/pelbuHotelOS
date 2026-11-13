import { loadApiEnvFile } from "./platform/load-env.js";
loadApiEnvFile();

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { globalOutbox, type Actor, type OutboxEvent } from "./platform/command.js";
import { store } from "./platform/memory-store.js";
import { MODULE_REGISTRY, commandHandlers } from "./modules/registry.js";
import { runCoreHandlers } from "./modules/handlers.js";

import "./modules/wave-a.js";
import "./modules/wave-b.js";
import "./modules/wave-c.js";
import "./modules/wave-d.js";
import "./modules/wave-e.js";
import "./modules/wave-f.js";
import "./modules/wave-g.js";
import "./modules/wave-h.js";
import "./modules/wave-i.js";
import "./modules/hermes/wave-hermes.js";
import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "./modules/hermes/handle-update.js";
import { telegramWebhookSecret } from "./modules/hermes/bot-api.js";
import {
  admsHandshakeBody,
  lateMinutesForPunch,
  normalizeActorRole,
  parseAttlogBody,
  pickShiftForPunch,
} from "@hos-v2/domain";
import {
  getDatabaseUrl,
  getDb,
  getOpenTillBalance,
  initDbFromEnv,
  insertAttendancePunches,
  listAttendancePunches,
  loadFrontOfficeSnapshot,
  queryRaw,
  requireDb,
  resolveDefaultPropertyId,
} from "@hos-v2/db";
import { assertNoPublicBookingsAccess } from "./platform/public-guard.js";
import { getProcurementAdvances } from "./modules/wave-i.js";
import { registerOpsRestRoutes } from "./modules/ops-rest.js";
import { registerAuthPinRoutes } from "./modules/auth-pin.js";
import { registerAuthPortalRoutes } from "./modules/auth-portals.js";
import { registerAuthHotelEmailRoutes } from "./modules/auth-hotel-email.js";
import { registerAuthPortalEmailRoutes } from "./modules/auth-portal-email.js";
import { registerAuthE2eDemoRoutes } from "./modules/auth-e2e-demo.js";
import { bearerToken, verifyDeskToken } from "./platform/desk-token.js";

const auditBuffer: unknown[] = [];

function makeCtx(actor: Actor) {
  const pending: OutboxEvent[] = [];
  return {
    ctx: {
      actor,
      emit: (event: OutboxEvent) => {
        pending.push(event);
      },
      audit: (entry: {
        action: string;
        entityType: string;
        entityId?: string;
        before?: unknown;
        after?: unknown;
        reason?: string;
      }) => {
        auditBuffer.push({ ...entry, at: new Date().toISOString(), actor });
      },
    },
    flush() {
      for (const event of pending) {
        globalOutbox.push(actor.propertyId, event);
      }
      pending.length = 0;
    },
  };
}

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await registerAuthPinRoutes(app);
await registerAuthPortalRoutes(app);
await registerAuthHotelEmailRoutes(app);
await registerAuthPortalEmailRoutes(app);
registerAuthE2eDemoRoutes(app);

app.addContentTypeParser(
  "text/plain",
  { parseAs: "string" },
  (_req, body, done) => {
    done(null, body);
  },
);

app.get("/health", async () => ({
  ok: true,
  app: "hos-v2-api",
  modules: MODULE_REGISTRY.length,
  commands: commandHandlers.size,
}));

/** Telegram Hermes webhook — secret via header `x-telegram-bot-api-secret-token`. */
app.post<{ Body: TelegramUpdate }>("/v1/telegram/webhook", async (req, reply) => {
  const expected = telegramWebhookSecret();
  if (expected) {
    const got = String(req.headers["x-telegram-bot-api-secret-token"] ?? "");
    if (got !== expected) {
      return reply.code(401).send({ ok: false, error: "Invalid webhook secret" });
    }
  }
  try {
    const result = await handleTelegramUpdate(req.body ?? {});
    return { ok: true, ...result };
  } catch (err) {
    req.log.error({ err }, "telegram webhook failed");
    return reply.code(500).send({
      ok: false,
      error: err instanceof Error ? err.message : "webhook error",
    });
  }
});

app.get("/v1/modules", async () => ({ modules: MODULE_REGISTRY }));

app.get("/v1/commands", async () => ({
  commands: [...commandHandlers.keys()].sort(),
}));

app.post<{
  Body: { command: string; input: unknown; actor: Actor };
}>("/v1/command", async (req, reply) => {
  const { command, input, actor: bodyActor } = req.body ?? ({} as never);
  if (!command) {
    return reply.code(400).send({ ok: false, error: "command required" });
  }

  const claims = verifyDeskToken(bearerToken(req.headers.authorization));
  if (!claims || !["staff", "owner", "agent", "guide", "driver"].includes(claims.role)) {
    return reply.code(401).send({ ok: false, error: "Valid desk/portal session required" });
  }
  if (claims.role === "hotel_desk") {
    return reply.code(403).send({ ok: false, error: "Staff PIN unlock required before commands" });
  }

  const actor: Actor = {
    propertyId: claims.propertyId,
    tenantId: claims.organizationId ?? claims.propertyId,
    role: normalizeActorRole(
      claims.deskRole || claims.role || bodyActor?.role || "fo_agent",
    ),
    staffId: claims.staffId ?? claims.sub,
  };
  if (bodyActor?.propertyId && bodyActor.propertyId !== claims.propertyId) {
    return reply.code(403).send({ ok: false, error: "Actor property does not match session" });
  }

  const fn = commandHandlers.get(command);
  if (!fn) return reply.code(404).send({ ok: false, error: `Unknown command ${command}` });

  const { ctx, flush } = makeCtx(actor);
  try {
    const result = await fn(input, ctx);
    if (result.ok) flush();
    await runCoreHandlers();
    return result;
  } catch (err) {
    req.log.error({ err, command }, "command failed");
    return reply.code(400).send({
      ok: false,
      error: err instanceof Error ? err.message : "command error",
    });
  }
});

app.get<{
  Querystring: { propertyId?: string; since?: string; limit?: string };
}>("/v1/outbox", async (req) => {
  const since = Number(req.query.since ?? "0");
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? "50") || 50));
  const propertyId = req.query.propertyId;
  const events =
    Number.isFinite(since) && since > 0
      ? globalOutbox.since({
          propertyId,
          afterSeq: since,
          limit,
        })
      : propertyId
        ? globalOutbox.events.filter((e) => e.propertyId === propertyId).slice(-limit)
        : globalOutbox.events.slice(-limit);
  return {
    events,
    receipts: globalOutbox.receipts.size,
    audit: auditBuffer.slice(-50),
    cursor: events.length ? events[events.length - 1]!.seq : since || 0,
    serverTime: new Date().toISOString(),
  };
});

/** Server-Sent Events — desk live board. Falls back to /v1/outbox poll on proxy issues. */
app.get<{ Querystring: { propertyId?: string; since?: string } }>(
  "/v1/live/stream",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
      return reply.code(400).send({ ok: false, error: "propertyId required" });
    }
    let cursor = Number(req.query.since ?? "0");
    if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

    reply.hijack();
    /* hijack bypasses @fastify/cors — EventSource needs explicit ACAO. */
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Cache-Control",
      Vary: "Origin",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send("hello", {
      ok: true,
      propertyId,
      cursor,
      serverTime: new Date().toISOString(),
    });

    for (const ev of globalOutbox.since({ propertyId, afterSeq: cursor, limit: 100 })) {
      send("outbox", ev);
      cursor = Math.max(cursor, ev.seq);
    }

    const unsub = globalOutbox.subscribe((ev) => {
      if (ev.propertyId !== propertyId) return;
      if (ev.seq <= cursor) return;
      send("outbox", ev);
      cursor = ev.seq;
    });

    const heartbeat = setInterval(() => {
      send("ping", { t: Date.now(), cursor });
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsub();
    };
    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);
  },
);

app.get<{ Querystring: { propertyId?: string } }>("/v1/settings/snapshot", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  const property = store.ensureDemoProperty(propertyId);
  return {
    ok: true,
    property,
    roomTypes: store.roomTypes.filter((r) => r.propertyId === propertyId),
    rooms: store.rooms.filter((r) => r.propertyId === propertyId),
  };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/hr/staff", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  store.ensureDemoProperty(propertyId);
  return {
    ok: true,
    staff: store.staff.filter((s) => s.propertyId === propertyId),
  };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/rates/snapshot", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  const property = store.ensureDemoProperty(propertyId);
  return {
    ok: true,
    property,
    ratePlans: store.ratePlans.filter((p) => p.propertyId === propertyId),
    roomTypes: store.roomTypes.filter((r) => r.propertyId === propertyId),
    rates: store.rates.filter((r) => r.propertyId === propertyId),
  };
});

/** Desk commercial + registry hydrate — agents/guides from v2 vault (ETL from public). */
app.get<{ Querystring: { propertyId?: string } }>(
  "/v1/partners/snapshot",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
      return reply.code(400).send({ ok: false, error: "propertyId required" });
    }
    const parsed = z.string().uuid().safeParse(propertyId);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: "propertyId must be a UUID" });
    }
    const dbGate = requireDb();
    if (!dbGate.ok) {
      return reply.code(503).send({ ok: false, error: "DATABASE_REQUIRED" });
    }
    const pid = parsed.data.replace(/'/g, "''");
    try {
      type AgentRow = {
        id: string;
        name: string;
        code: string;
        credit_limit: string | number;
        credit_hold: boolean;
        contact: string | null;
        status: string | null;
      };
      type GuideRow = {
        id: string;
        name: string;
        tcr: string;
        phone: string | null;
        languages: string[] | null;
        verified: boolean;
        active: boolean;
      };
      const agents = (await queryRaw(
        `SELECT
           a.id::text AS id,
           a.name,
           a.code,
           a.credit_limit,
           a.credit_hold,
           NULLIF(trim(concat_ws(' · ',
             NULLIF(trim(pa.contact_phone), ''),
             NULLIF(trim(pa.contact_email), '')
           )), '') AS contact,
           COALESCE(pa.status, 'approved') AS status
         FROM v2.agents a
         LEFT JOIN v2.etl_id_map m
           ON m.entity = 'agent'
          AND m.property_id = a.property_id
          AND m.v2_id = a.id
         LEFT JOIN public.agents pa
           ON pa.id = COALESCE(m.public_id, a.id)
         WHERE a.property_id = '${pid}'::uuid
         ORDER BY a.name ASC`,
      )) as AgentRow[];
      const guides = (await queryRaw(
        `SELECT
           g.id::text AS id,
           g.full_name AS name,
           g.tcr_license_no AS tcr,
           g.phone,
           g.languages,
           (g.status = 'active' OR g.active = true) AS verified,
           g.active
         FROM v2.tour_guides g
         WHERE g.property_id = '${pid}'::uuid
         ORDER BY g.full_name ASC`,
      )) as GuideRow[];
      return {
        ok: true,
        propertyId: parsed.data,
        agents: (agents ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          creditLimit: Number(a.credit_limit) || 0,
          creditHold: Boolean(a.credit_hold),
          contact: a.contact ?? "",
          status: a.status ?? "approved",
        })),
        guides: (guides ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          tcr: g.tcr,
          phone: g.phone ?? "",
          languages: Array.isArray(g.languages) ? g.languages.join(" · ") : "",
          verified: Boolean(g.verified),
          active: Boolean(g.active),
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "partners snapshot failed";
      req.log.error({ err }, "partners/snapshot failed");
      return reply.code(500).send({ ok: false, error: message });
    }
  },
);

function enrichBooking(b: (typeof store.bookings)[number]) {
  const guestFolio = store.folios.find((f) => f.bookingId === b.id && f.payerType === "guest");
  const agencyFolio = store.folios.find((f) => f.bookingId === b.id && f.payerType === "agent");
  const mapLines = (
    folioId: string | undefined,
    defaultStream: "master" | "personal",
  ) => {
    if (!folioId) return [];
    return store.folioLines
      .filter((l) => l.folioId === folioId)
      .map((l) => ({
        id: l.id,
        description: l.description,
        net: l.net,
        kind: l.sourceType,
        sourceId: l.sourceId,
        stream: l.stream ?? defaultStream,
      }));
  };
  // Agency room+meal must hydrate onto desk master bill (GroupInvoiceModal).
  const folioLines = [
    ...mapLines(guestFolio?.id, "personal"),
    ...mapLines(agencyFolio?.id, "master"),
  ];
  const guest = b.guestId
    ? store.guests.find((g) => g.id === b.guestId)
    : undefined;
  const group = b.groupId
    ? store.groups.find((g) => g.id === b.groupId)
    : undefined;
  const agencyName =
    b.agencyName?.trim() ||
    group?.name?.trim() ||
    (b.source === "agent_portal" && /Yangphel/i.test(b.guestName)
      ? "Yangphel Adventure Travel"
      : b.source === "agent_portal" && /Druk/i.test(b.guestName)
        ? "Druk Asia Tours & Treks"
        : null) ||
    null;
  return {
    ...b,
    guestId: b.guestId,
    agencyName,
    passportOrCid: guest?.passportOrCid ?? null,
    nationality: guest?.nationality ?? null,
    roomNumbers: b.lines
      .map((l) => store.rooms.find((r) => r.id === l.roomId)?.number)
      .filter(Boolean),
    unassigned: b.lines.some((l) => !l.roomId),
    folioBalance: guestFolio?.balance ?? 0,
    agencyBalance: agencyFolio?.balance ?? 0,
    folioId: guestFolio?.id,
    agencyFolioId: agencyFolio?.id,
    folioLines,
  };
}

app.get<{ Querystring: { propertyId?: string } }>("/v1/desk/day", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  const property = store.ensureDemoProperty(propertyId);
  const day = property.currentBusinessDate;
  const [y, m, d] = day.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + 1))
    .toISOString()
    .slice(0, 10);

  const mine = store.bookings.filter((b) => b.propertyId === propertyId);
  const arrivals = mine
    .filter((b) => b.checkIn === day && ["confirmed", "held"].includes(b.status))
    .map(enrichBooking);
  const inHouse = mine.filter((b) => b.status === "checked_in").map(enrichBooking);
  const departures = mine
    .filter((b) => b.checkOut === day && b.status === "checked_in")
    .map(enrichBooking);
  const tomorrowArrivals = mine
    .filter((b) => b.checkIn === tomorrow && !["cancelled", "no_show", "expired"].includes(b.status))
    .map(enrichBooking);

  const totalRooms = store.rooms.filter((r) => r.propertyId === propertyId).length;
  const occupied = inHouse.length;
  const dirtyRooms = store.rooms.filter(
    (r) => r.propertyId === propertyId && r.hkStatus === "dirty",
  ).length;
  const openBalances = store.folios.filter(
    (f) => f.propertyId === propertyId && f.balance > 0,
  ).length;

  return {
    ok: true,
    businessDate: day,
    kpis: {
      occupancyPct: totalRooms ? Math.round((occupied / totalRooms) * 100) : null,
      arrivalsLeft: arrivals.length,
      departuresLeft: departures.length,
      dirtyRooms,
      openBalances,
    },
    arrivals,
    inHouse,
    departures,
    tomorrow: tomorrowArrivals,
    alerts: [
      ...arrivals
        .filter((a) => a.unassigned)
        .map((a) => ({
          id: `unassigned-${a.id}`,
          severity: "warn",
          text: `Unassigned arrival ${a.confirmationNo} · ${a.guestName}`,
          href: `/stayview?booking=${a.id}`,
        })),
      ...(store.roomTypes.filter((t) => t.propertyId === propertyId).length === 0
        ? [{ id: "no-types", severity: "warn", text: "No room types — open Settings", href: "/settings" }]
        : []),
      ...(store.ratePlans.filter((p) => p.propertyId === propertyId).length === 0
        ? [{ id: "no-rates", severity: "warn", text: "No rate plans — open Rates", href: "/rates" }]
        : []),
    ],
  };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/stayview/blocks", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  const blocks = store.roomBlocks
    .filter((b) => b.propertyId === propertyId && b.releasedAt == null)
    .map((b) => ({
      id: b.id,
      roomId: b.roomId,
      blockKind: b.blockKind,
      fromDate: b.fromDate,
      toDate: b.toDate,
      reason: b.reason,
    }))
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  return { ok: true, blocks };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/reservations", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  return {
    ok: true,
    bookings: store.bookings
      .filter((b) => b.propertyId === propertyId)
      .map(enrichBooking)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    roomTypes: store.roomTypes.filter((t) => t.propertyId === propertyId),
    ratePlans: store.ratePlans.filter((p) => p.propertyId === propertyId),
    groups: store.groups.filter((g) => g.propertyId === propertyId),
  };
});

app.get<{ Params: { id: string }; Querystring: { propertyId?: string } }>(
  "/v1/stays/:id",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
    const booking = store.bookings.find(
      (b) => b.id === req.params.id && b.propertyId === propertyId,
    );
    if (!booking) return reply.code(404).send({ ok: false, error: "Not found" });
    const guest = store.guests.find((g) => g.id === booking.guestId);
    const guestFolio = store.folios.find(
      (f) => f.bookingId === booking.id && f.payerType === "guest",
    );
    const agencyFolio = store.folios.find(
      (f) => f.bookingId === booking.id && f.payerType === "agent",
    );
    const rooms = store.rooms.filter((r) => r.propertyId === propertyId);
    const enriched = enrichBooking(booking);
    return {
      ok: true,
      booking: enriched,
      guest: guest ?? null,
      folio: guestFolio ?? null,
      guestFolio: guestFolio ?? null,
      agencyFolio: agencyFolio ?? null,
      folioLines: enriched.folioLines,
      roomTypes: store.roomTypes.filter((t) => t.propertyId === propertyId),
      rooms,
    };
  },
);

app.get<{ Querystring: { propertyId?: string; from?: string; days?: string } }>(
  "/v1/stayview",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
    const prop = store.ensureDemoProperty(propertyId);
    const from = req.query.from ?? prop.currentBusinessDate;
    const days = Math.min(21, Math.max(1, Number(req.query.days ?? 7)));
    const dates: string[] = [];
    {
      const cur = new Date(from + "T00:00:00Z");
      for (let i = 0; i < days; i++) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    const rooms = store.rooms.filter((r) => r.propertyId === propertyId);
    const types = store.roomTypes.filter((t) => t.propertyId === propertyId);
    const unassigned = store.bookings
      .filter(
        (b) =>
          b.propertyId === propertyId &&
          !["cancelled", "checked_out", "no_show", "expired"].includes(b.status) &&
          b.lines.some((l) => !l.roomId),
      )
      .map(enrichBooking);
    return {
      ok: true,
      from,
      dates,
      roomTypes: types,
      rooms,
      assignments: store.assignments.filter((a) => a.propertyId === propertyId && a.active),
      bookings: store.bookings
        .filter((b) => b.propertyId === propertyId)
        .map(enrichBooking),
      unassigned,
    };
  },
);

app.get<{ Querystring: { propertyId?: string; q?: string } }>("/v1/guests", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  const q = (req.query.q ?? "").trim().toLowerCase();
  let guests = store.guests.filter((g) => g.propertyId === propertyId);
  if (q) {
    guests = guests.filter(
      (g) =>
        g.fullName.toLowerCase().includes(q) ||
        (g.phone ?? "").includes(q) ||
        (g.email ?? "").toLowerCase().includes(q),
    );
  }
  return { ok: true, guests };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/groups", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  return {
    ok: true,
    groups: store.groups
      .filter((g) => g.propertyId === propertyId)
      .map((g) => ({
        ...g,
        bookingCount: store.bookings.filter((b) => b.groupId === g.id).length,
      })),
  };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/night-audit/preview", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) return reply.code(400).send({ ok: false, error: "propertyId required" });
  const prop = store.ensureDemoProperty(propertyId);
  const day = prop.currentBusinessDate;
  const mine = store.bookings.filter((b) => b.propertyId === propertyId);
  return {
    ok: true,
    businessDate: day,
    checklist: [
      {
        id: "arrivals",
        label: "Arrivals not checked in",
        count: mine.filter(
          (b) => b.checkIn === day && ["confirmed", "held"].includes(b.status),
        ).length,
      },
      {
        id: "departures",
        label: "Departures still in-house",
        count: mine.filter((b) => b.checkOut === day && b.status === "checked_in").length,
      },
      {
        id: "holds",
        label: "Holds expiring today",
        count: mine.filter((b) => b.status === "held" && b.checkIn <= day).length,
      },
      {
        id: "dirty",
        label: "Dirty vacant rooms",
        count: store.rooms.filter(
          (r) =>
            r.propertyId === propertyId &&
            r.hkStatus === "dirty" &&
            !store.assignments.some(
              (a) =>
                a.active &&
                a.roomId === r.id &&
                a.stayDate === day,
            ),
        ).length,
      },
    ],
  };
});

/** ZKTeco iClock / ADMS push — handshake */
app.get<{
  Querystring: { SN?: string; sn?: string; options?: string };
}>("/iclock/cdata", async (req, reply) => {
  const sn = req.query.SN ?? req.query.sn ?? "UNKNOWN";
  reply.type("text/plain");
  return admsHandshakeBody(sn);
});

const DEFAULT_SHIFTS = [
  {
    id: "morning",
    code: "morning",
    startTime: "08:00",
    endTime: "16:00",
    graceMinutes: 10,
  },
  {
    id: "evening",
    code: "evening",
    startTime: "14:00",
    endTime: "22:00",
    graceMinutes: 10,
  },
  {
    id: "night",
    code: "night",
    startTime: "22:00",
    endTime: "06:00",
    graceMinutes: 10,
  },
];

/** ZKTeco ATTLOG push — persists to v2.attendance_punches when DATABASE_URL is set. */
app.post<{
  Querystring: { SN?: string; sn?: string; table?: string };
}>("/iclock/cdata", async (req, reply) => {
  const sn = req.query.SN ?? req.query.sn ?? "UNKNOWN";
  const table = (req.query.table ?? "").toUpperCase();
  reply.type("text/plain");
  // ZKTeco ADMS law: plaintext OK + newline or device crash / halt punch memory.
  const OK = "OK\n";
  if (table && table !== "ATTLOG") {
    return OK;
  }
  const body =
    typeof req.body === "string"
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : String(req.body ?? "");
  const punches = parseAttlogBody(body);
  const dbGate = requireDb();
  if (!dbGate.ok) {
    app.log.warn(
      { count: punches.length, sn },
      "ADMS ATTLOG dropped — DATABASE_REQUIRED (no memory punch log)",
    );
    return OK;
  }
  const propertyId = await resolveDefaultPropertyId(dbGate.db);
  if (!propertyId) {
    app.log.error({ sn }, "ADMS ATTLOG dropped — no v2.properties row");
    return OK;
  }
  const rows = punches.map((p) => {
    const shift = pickShiftForPunch(p.punchedAtIso, DEFAULT_SHIFTS);
    const late = shift ? lateMinutesForPunch(p.punchedAtIso, shift) : 0;
    return {
      propertyId,
      deviceSn: sn,
      employeeCode: p.employeeCode,
      punchedAt: new Date(p.punchedAtIso),
      punchType: p.punchType,
      verifyMode: p.verifyMode,
      rawLine: p.rawLine,
      lateMinutes: late,
    };
  });
  try {
    await insertAttendancePunches(dbGate.db, rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    app.log.error({ err: msg, sn }, "ADMS ATTLOG persist failed");
  }
  return OK;
});

app.get<{ Querystring: { propertyId?: string } }>(
  "/v1/hr/punches",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
      return reply.code(400).send({ ok: false, error: "propertyId required" });
    }
    const dbGate = requireDb();
    if (!dbGate.ok) {
      return reply.code(503).send({ ok: false, error: dbGate.error });
    }
    const punches = await listAttendancePunches(dbGate.db, propertyId);
    return { ok: true, punches };
  },
);

app.get<{ Querystring: { propertyId?: string } }>(
  "/v1/procurement/advances",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
      return reply.code(400).send({ ok: false, error: "propertyId required" });
    }
    const result = await getProcurementAdvances(propertyId);
    if (!result.ok) {
      return reply.code(503).send({ ok: false, error: result.error });
    }
    return { ok: true, advances: result.advances };
  },
);

app.get<{ Querystring: { propertyId?: string } }>(
  "/v1/finance/till",
  async (req, reply) => {
    const propertyId = req.query.propertyId;
    if (!propertyId) {
      return reply.code(400).send({ ok: false, error: "propertyId required" });
    }
    const dbGate = requireDb();
    if (!dbGate.ok) {
      return reply.code(503).send({ ok: false, error: dbGate.error });
    }
    const till = await getOpenTillBalance(dbGate.db, propertyId);
    return { ok: true, ...till };
  },
);

app.get<{
  Querystring: { propertyId?: string; asOfDate?: string };
}>("/v1/compliance/immigration-manifest", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) {
    return reply.code(400).send({ ok: false, error: "propertyId required" });
  }
  const asOfDate =
    req.query.asOfDate ?? new Date().toISOString().slice(0, 10);
  const { ctx, flush } = makeCtx({
    staffId: "00000000-0000-4000-8000-0000000000aa",
    role: "gm",
    propertyId,
    tenantId: propertyId,
  });
  const fn = commandHandlers.get("compliance.immigrationManifest");
  if (!fn) {
    return reply.code(500).send({ ok: false, error: "COMMAND_MISSING" });
  }
  try {
    const result = await fn({ propertyId, asOfDate }, ctx);
    if (result.ok) flush();
    if (!result.ok) {
      const status = result.error === "DATABASE_REQUIRED" ? 503 : 400;
      return reply.code(status).send(result);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err: msg }, "immigration-manifest failed");
    return reply.code(500).send({ ok: false, error: "MANIFEST_FAILED" });
  }
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/pos/catalog", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) {
    return reply.code(400).send({ ok: false, error: "propertyId required" });
  }
  const { outletId } = store.ensurePosCatalog(propertyId);
  return {
    ok: true,
    outletId,
    outlets: store.outlets.filter((o) => o.propertyId === propertyId),
    menu: store.menuItems.filter((m) => m.propertyId === propertyId),
    shift:
      store.posShifts.find(
        (s) => s.propertyId === propertyId && s.status === "open",
      ) ?? null,
    unsettledCount: store.posOrders.filter(
      (o) =>
        o.propertyId === propertyId &&
        (o.status === "open" || o.status === "fired" || o.status === "billed"),
    ).length,
  };
});

app.get<{ Querystring: { propertyId?: string } }>("/v1/kds/tickets", async (req, reply) => {
  const propertyId = req.query.propertyId;
  if (!propertyId) {
    return reply.code(400).send({ ok: false, error: "propertyId required" });
  }
  return {
    ok: true,
    tickets: store.kotTickets
      .filter((t) => t.propertyId === propertyId)
      .sort((a, b) => a.createdAt - b.createdAt),
  };
});

registerOpsRestRoutes(app, makeCtx);

const port = Number(process.env.PORT ?? 4200);

async function main() {
  const url = getDatabaseUrl();
  if (url) {
    initDbFromEnv();
    await assertNoPublicBookingsAccess((sqlText) => queryRaw(sqlText));
    app.log.info("DATABASE_URL bound — ops-law writes use schema v2 (ADR 001 guard ok)");
    const db = getDb();
    if (db) {
      const hydrated = await loadFrontOfficeSnapshot(db);
      if (!hydrated.ok) {
        app.log.error({ err: hydrated.error }, "FO PG boot hydrate failed");
      } else {
        const counts = store.applyFrontOfficeSnapshot(hydrated.data);
        app.log.info(
          counts,
          "FO memory hydrated from Postgres (bookings/folios/lines/assignments)",
        );
      }
    }
  } else {
    app.log.warn(
      "No DATABASE_URL — hard-law commands return DATABASE_REQUIRED (no memory fallback)",
    );
  }
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
