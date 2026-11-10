import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createServiceClient } from "@hotel-os/db";
import { requirePlatformAdmin } from "./auth.js";
import {
  nightsBetween,
  quotePropertyStay,
  roundBtn,
} from "./adapters/rates.js";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function statusOf(e: unknown): number {
  const c = Number((e as { statusCode?: number } | null)?.statusCode);
  return Number.isInteger(c) && c >= 400 && c < 600 ? c : 400;
}

export async function registerMarketplaceRoutes(app: FastifyInstance) {
  app.get("/v1/marketplace/explore", async (req, reply) => {
    const q = z
      .object({
        checkIn: z.string().regex(dateRe),
        checkOut: z.string().regex(dateRe),
        market: z.enum(["local", "international"]).default("local"),
      })
      .safeParse(req.query);

    if (!q.success) {
      return reply.code(400).send({
        error:
          "checkIn and checkOut (YYYY-MM-DD) are required for priced explore",
        details: q.error.flatten(),
      });
    }

    if (q.data.checkOut <= q.data.checkIn) {
      return reply
        .code(400)
        .send({ error: "checkOut must be after checkIn" });
    }

    try {
      const admin = createServiceClient();
      const { data: properties, error } = await admin
        .from("properties")
        .select("id, name, slug")
        .limit(100);
      if (error) throw error;

      const inventory = [];
      for (const p of properties ?? []) {
        try {
          const quote = await quotePropertyStay(admin, {
            propertyId: p.id as string,
            checkIn: q.data.checkIn,
            checkOut: q.data.checkOut,
            rooms: 1,
            adults: 2,
          });
          inventory.push({
            propertyId: p.id,
            name: p.name,
            slug: p.slug,
            city: null,
            starRating: null,
            availableRooms: quote.availableRooms,
            nightlyFromBtn: quote.nightlyFromBtn,
            stayFromBtn: quote.stayFromBtn,
            nights: quote.nights,
            seasonKind: quote.seasonKind,
            roomTypeQuotes: quote.roomTypeQuotes,
            market: q.data.market,
            currency: q.data.market === "international" ? "USD" : "BTN",
            commissionRate: q.data.market === "international" ? 0.05 : 0.03,
          });
        } catch (propErr) {
          req.log.warn(
            { err: propErr, propertyId: p.id },
            "marketplace explore quote skipped",
          );
          const { count } = await admin
            .from("room_units")
            .select("id", { count: "exact", head: true })
            .eq("property_id", p.id);
          inventory.push({
            propertyId: p.id,
            name: p.name,
            slug: p.slug,
            city: null,
            starRating: null,
            availableRooms: count ?? 0,
            nightlyFromBtn: null,
            stayFromBtn: null,
            nights: Math.max(
              1,
              Math.round(
                (Date.parse(`${q.data.checkOut}T00:00:00Z`) -
                  Date.parse(`${q.data.checkIn}T00:00:00Z`)) /
                  86400000,
              ),
            ),
            seasonKind: "lean",
            roomTypeQuotes: [],
            market: q.data.market,
            currency: q.data.market === "international" ? "USD" : "BTN",
            commissionRate: q.data.market === "international" ? 0.05 : 0.03,
            quoteWarning:
              propErr instanceof Error ? propErr.message : String(propErr),
          });
        }
      }
      return {
        checkIn: q.data.checkIn,
        checkOut: q.data.checkOut,
        results: inventory,
      };
    } catch (err) {
      req.log.error({ err }, "marketplace explore failed");
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Explore failed";
      return reply.code(500).send({
        error: message,
        checkIn: q.data.checkIn,
        checkOut: q.data.checkOut,
        results: [],
      });
    }
  });

  app.get("/v1/marketplace/property/:slug", async (req, reply) => {
    try {
      const admin = createServiceClient();
      const { slug } = req.params as { slug: string };
      const q = req.query as { checkIn?: string; checkOut?: string };
      const { data: property, error } = await admin
        .from("properties")
        .select("id, name, slug, timezone")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!property) return reply.code(404).send({ error: "Property not found" });

      const { data: types } = await admin
        .from("room_types")
        .select("id, name, code")
        .eq("property_id", property.id);

      const { count } = await admin
        .from("room_units")
        .select("id", { count: "exact", head: true })
        .eq("property_id", property.id);

      let quote = null;
      if (
        q.checkIn &&
        q.checkOut &&
        dateRe.test(q.checkIn) &&
        dateRe.test(q.checkOut) &&
        q.checkOut > q.checkIn
      ) {
        quote = await quotePropertyStay(admin, {
          propertyId: property.id as string,
          checkIn: q.checkIn,
          checkOut: q.checkOut,
        });
      }

      return {
        property: {
          ...property,
          city: null,
        },
        roomTypes: types ?? [],
        sellableUnits: count ?? 0,
        quote,
      };
    } catch (e) {
      return reply
        .code(statusOf(e))
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/v1/marketplace/book", async (req, reply) => {
    try {
      const body = z
        .object({
          propertyId: z.string().uuid(),
          contactName: z.string().min(1),
          contactPhone: z.string().optional(),
          contactEmail: z.string().email().optional().or(z.literal("")),
          checkIn: z.string().regex(dateRe),
          checkOut: z.string().regex(dateRe),
          adults: z.number().int().min(1).default(2),
          rooms: z.number().int().min(1).default(1),
          market: z.enum(["local", "international"]).default("international"),
          idempotencyKey: z.string().uuid(),
          // Price is ALWAYS server-quoted. Never accept a client-supplied rate
          // on this public endpoint (it was writable as agreed_nightly_rate_btn,
          // which night audit posts ahead of the rate sheet).
          roomTypeId: z.string().uuid().optional(),
        })
        .strict()
        .parse(req.body);

      if (body.checkOut <= body.checkIn) {
        return reply
          .code(400)
          .send({ error: "checkOut must be after checkIn" });
      }

      const admin = createServiceClient();
      const cached = await admin
        .from("idempotency_keys")
        .select("response")
        .eq("property_id", body.propertyId)
        .eq("idempotency_key", body.idempotencyKey)
        .maybeSingle();
      if (cached.data?.response) {
        return { ...(cached.data.response as object), replayed: true };
      }

      const quote = await quotePropertyStay(admin, {
        propertyId: body.propertyId,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        rooms: body.rooms,
        adults: body.adults,
      });

      if (quote.availableRooms < body.rooms) {
        return reply.code(409).send({
          error: `Only ${quote.availableRooms} rooms available for those dates`,
        });
      }

      let nightly: number | null;
      if (body.roomTypeId) {
        const hit = quote.roomTypeQuotes.find(
          (r) => r.roomTypeId === body.roomTypeId,
        );
        if (!hit) {
          return reply.code(400).send({ error: "Room type not available for those dates" });
        }
        nightly = hit.nightlyBtn ?? null;
      } else {
        nightly = quote.nightlyFromBtn;
      }
      if (nightly == null || nightly <= 0) {
        return reply.code(400).send({
          error: "No public rate found for those dates",
        });
      }

      // Public bookings are HELD until the property takes a deposit / confirms
      // (same TTL rules Innora uses: hold_ttl_rules, source=client).
      const { data: ttlRule } = await admin
        .from("hold_ttl_rules")
        .select("ttl_hours")
        .eq("property_id", body.propertyId)
        .eq("source", "client")
        .eq("season_kind", quote.seasonKind)
        .maybeSingle();
      const ttlHours = Number(ttlRule?.ttl_hours ?? 24);
      const holdExpiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();

      const nights = nightsBetween(body.checkIn, body.checkOut);
      const quoted = roundBtn(nightly * nights * body.rooms);

      const { data: seq, error: seqErr } = await admin.rpc(
        "next_property_sequence",
        {
          p_property_id: body.propertyId,
          p_kind: "booking_confirmation",
        },
      );
      if (seqErr) {
        console.error("[marketplace.book] sequence", seqErr);
        throw new Error(seqErr.message ?? "Could not allocate confirmation code");
      }
      const confirmationCode =
        typeof seq === "string"
          ? seq
          : (seq as { code?: string })?.code;
      if (!confirmationCode) {
        throw new Error("next_property_sequence returned empty code");
      }

      const depositBtn = roundBtn(Math.max(quoted * 0.3, nightly));
      const { data: booking, error } = await admin
        .from("bookings")
        .insert({
          property_id: body.propertyId,
          confirmation_code: confirmationCode,
          contact_name: body.contactName.trim(),
          contact_phone: body.contactPhone?.trim() || null,
          contact_email: body.contactEmail?.trim() || null,
          check_in: body.checkIn,
          check_out: body.checkOut,
          status: "held",
          hold_expires_at: holdExpiresAt,
          adults: body.adults,
          rooms: body.rooms,
          source: "marketplace",
          guest_origin:
            body.market === "local" ? "local" : "international",
          quoted_total_btn: quoted,
          token_required_btn: depositBtn,
          payment_mode: "partial",
        })
        .select("id, confirmation_code")
        .single();
      if (error) throw error;

      // Commission is earned when the stay is confirmed (deposit path), not on hold.
      const rate = body.market === "international" ? 0.05 : 0.03;
      const commission = roundBtn(quoted * rate);

      const payToken = `mpl_${body.idempotencyKey.replace(/-/g, "").slice(0, 24)}`;
      const { error: linkErr } = await admin.from("payment_links").insert({
        property_id: body.propertyId,
        booking_id: booking.id,
        token: payToken,
        amount_btn: depositBtn,
        purpose: "deposit",
        payee_name: body.contactName.trim(),
        payee_phone: body.contactPhone?.trim() || null,
        status: "open",
        expires_at: holdExpiresAt,
      });
      if (linkErr) {
        console.error("[marketplace.book] payment_links", linkErr);
      }

      const result = {
        ok: true,
        bookingId: booking.id as string,
        confirmationCode: booking.confirmation_code as string,
        nightlyBtn: nightly,
        quotedTotalBtn: quoted,
        nights,
        seasonKind: quote.seasonKind,
        status: "held",
        holdExpiresAt,
        expectedCommissionBtn: commission,
        depositBtn,
        paymentToken: linkErr ? null : payToken,
        paymentPath: linkErr ? null : `/pay/${payToken}`,
        payHint: linkErr
          ? "Held — property will send a deposit link"
          : "Held — pay deposit via paymentPath to confirm",
      };
      await admin.from("idempotency_keys").upsert(
        {
          property_id: body.propertyId,
          idempotency_key: body.idempotencyKey,
          operation: "marketplace_book",
          response: result,
        },
        { onConflict: "property_id,idempotency_key" },
      );
      return result;
    } catch (e) {
      return reply
        .code(statusOf(e))
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** Confirm a held marketplace booking and accrue platform commission (idempotent). */
  app.post("/v1/marketplace/confirm", async (req, reply) => {
    try {
      const body = z
        .object({
          propertyId: z.string().uuid(),
          bookingId: z.string().uuid(),
          idempotencyKey: z.string().uuid(),
          market: z.enum(["local", "international"]).default("local"),
        })
        .strict()
        .parse(req.body);

      const admin = createServiceClient();
      const cached = await admin
        .from("idempotency_keys")
        .select("response")
        .eq("property_id", body.propertyId)
        .eq("idempotency_key", body.idempotencyKey)
        .maybeSingle();
      if (cached.data?.response) {
        return { ...(cached.data.response as object), replayed: true };
      }

      const { data: booking, error: bErr } = await admin
        .from("bookings")
        .select(
          "id, property_id, status, source, quoted_total_btn, guest_origin, confirmation_code",
        )
        .eq("id", body.bookingId)
        .eq("property_id", body.propertyId)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }
      if (booking.source !== "marketplace") {
        return reply
          .code(400)
          .send({ error: "Only marketplace bookings accrue Innora OTA commission here" });
      }

      if (booking.status === "held") {
        const { error: updErr } = await admin
          .from("bookings")
          .update({ status: "confirmed", hold_expires_at: null })
          .eq("id", booking.id)
          .eq("property_id", body.propertyId)
          .eq("status", "held");
        if (updErr) throw updErr;
      } else if (booking.status !== "confirmed") {
        return reply.code(409).send({
          error: `Cannot confirm booking in status ${booking.status}`,
        });
      }

      const gross = Number(booking.quoted_total_btn ?? 0);
      if (!(gross > 0)) {
        return reply.code(400).send({ error: "Booking has no quoted total" });
      }

      const market =
        body.market ||
        (booking.guest_origin === "local" ? "local" : "international");
      const rate = market === "international" ? 0.05 : 0.03;
      const commissionBtn = roundBtn(gross * rate);

      const { data: existingComm } = await admin
        .from("marketplace_commission_ledger")
        .select("id, commission_btn")
        .eq("booking_id", booking.id)
        .maybeSingle();

      let commissionId = existingComm?.id as string | undefined;
      if (!existingComm) {
        const { data: inserted, error: cErr } = await admin
          .from("marketplace_commission_ledger")
          .insert({
            property_id: body.propertyId,
            booking_id: booking.id,
            market,
            gross_btn: gross,
            commission_rate: rate,
            commission_btn: commissionBtn,
            currency: market === "international" ? "USD" : "BTN",
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        commissionId = inserted.id as string;
      }

      const result = {
        ok: true,
        bookingId: booking.id as string,
        confirmationCode: booking.confirmation_code as string,
        status: "confirmed",
        commissionId: commissionId ?? null,
        commissionBtn: existingComm
          ? Number(existingComm.commission_btn)
          : commissionBtn,
        grossBtn: gross,
        market,
      };
      await admin.from("idempotency_keys").upsert(
        {
          property_id: body.propertyId,
          idempotency_key: body.idempotencyKey,
          operation: "marketplace_confirm",
          response: result,
        },
        { onConflict: "property_id,idempotency_key" },
      );
      return result;
    } catch (e) {
      return reply
        .code(statusOf(e))
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/v1/onboard/property", async (req, reply) => {
    try {
      // Creating a tenant is a platform operation — never open to the internet.
      await requirePlatformAdmin(req);
      const body = z
        .object({
          name: z.string().min(2),
          slug: z
            .string()
            .min(2)
            .regex(/^[a-z0-9-]+$/),
          timezone: z.string().default("Asia/Thimphu"),
          ownerEmail: z.string().email().optional(),
        })
        .parse(req.body);
      const admin = createServiceClient();
      const { data, error } = await admin
        .from("properties")
        .insert({
          name: body.name,
          slug: body.slug,
          timezone: body.timezone,
        })
        .select("id, name, slug")
        .single();
      if (error) throw error;

      await admin.from("saas_tenant_licenses").upsert(
        {
          property_id: data.id,
          tier: "boutique",
          status: "active",
          mrr_btn: 3500,
        },
        { onConflict: "property_id" },
      );

      return {
        ok: true,
        property: data,
        next: "Add staff PINs in desk Settings / Registry",
        ownerEmail: body.ownerEmail ?? null,
      };
    } catch (e) {
      return reply
        .code(statusOf(e))
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/v1/marketplace/booking-lookup", async (req, reply) => {
    const q = z
      .object({
        confirmation: z.string().min(3).max(64),
        contact: z.string().min(3).max(120),
      })
      .safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: "confirmation and contact are required" });
    }
    try {
      const admin = createServiceClient();
      const contact = q.data.contact.trim().toLowerCase();
      const { data: booking, error } = await admin
        .from("bookings")
        .select(
          "id, property_id, confirmation_code, status, check_in, check_out, contact_name, contact_email, contact_phone, quoted_total_btn, source",
        )
        .eq("confirmation_code", q.data.confirmation.trim())
        .eq("source", "marketplace")
        .maybeSingle();
      if (error) throw error;
      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }
      const email = String(booking.contact_email ?? "").toLowerCase();
      const phone = String(booking.contact_phone ?? "").replace(/\s+/g, "");
      const contactNorm = contact.replace(/\s+/g, "");
      const match =
        (email && email === contact) ||
        (phone && (phone === contactNorm || phone.endsWith(contactNorm)));
      if (!match) {
        return reply.code(403).send({ error: "Contact does not match this booking" });
      }
      const { data: prop } = await admin
        .from("properties")
        .select("name")
        .eq("id", booking.property_id)
        .maybeSingle();
      return {
        ok: true,
        booking: {
          id: booking.id,
          confirmationCode: booking.confirmation_code,
          status: booking.status,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          contactName: booking.contact_name,
          quotedTotalBtn: booking.quoted_total_btn,
          propertyName: prop?.name ?? null,
        },
      };
    } catch (e) {
      return reply
        .code(statusOf(e))
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/v1/marketplace/commission", async (req) => {
    await requirePlatformAdmin(req);
    const body = z
      .object({
        propertyId: z.string().uuid(),
        bookingId: z.string().uuid().optional(),
        market: z.enum(["local", "international"]),
        grossBtn: z.number().positive(),
      })
      .parse(req.body);
    const rate = body.market === "international" ? 0.05 : 0.03;
    const commission = Math.round(body.grossBtn * rate * 100) / 100;
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("marketplace_commission_ledger")
      .insert({
        property_id: body.propertyId,
        booking_id: body.bookingId ?? null,
        market: body.market,
        gross_btn: body.grossBtn,
        commission_rate: rate,
        commission_btn: commission,
        currency: body.market === "international" ? "USD" : "BTN",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });
}
