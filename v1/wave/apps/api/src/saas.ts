import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createServiceClient } from "@hotel-os/db";
import { randomBytes } from "node:crypto";
import { requireDeskJwt, requirePlatformAdmin } from "./auth.js";

const TIER_MRR: Record<string, number> = {
  boutique: 3500,
  professional: 6500,
  resort: 11500,
};

export async function assertLicenseAllowsWrite(propertyId: string) {
  const admin = createServiceClient();
  const { data } = await admin
    .from("saas_tenant_licenses")
    .select("status")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!data) return; // unset = allow (v1 properties)
  if (data.status === "hard_lock") {
    throw new Error("LICENSE_HARD_LOCK: renew subscription to post transactions");
  }
}

export async function registerSaasRoutes(app: FastifyInstance) {
  app.get("/v1/superadmin/tenants", async (req) => {
    await requirePlatformAdmin(req);
    const admin = createServiceClient();
    const { data: props } = await admin
      .from("properties")
      .select("id, name, slug, created_at");
    const { data: licenses } = await admin
      .from("saas_tenant_licenses")
      .select("*");
    const byId = new Map((licenses ?? []).map((l) => [l.property_id, l]));
    return {
      tenants: (props ?? []).map((p) => {
        const lic = byId.get(p.id);
        return {
          propertyId: p.id,
          name: p.name,
          slug: p.slug,
          tier: lic?.tier ?? "boutique",
          status: lic?.status ?? "active",
          mrrBtn: Number(lic?.mrr_btn ?? TIER_MRR.boutique),
          paidThrough: lic?.paid_through ?? null,
          graceUntil: lic?.grace_until ?? null,
        };
      }),
    };
  });

  app.post("/v1/superadmin/license", async (req) => {
    await requirePlatformAdmin(req);
    const body = z
      .object({
        propertyId: z.string().uuid(),
        tier: z.enum(["boutique", "professional", "resort"]),
        status: z
          .enum(["active", "grace", "soft_lock", "hard_lock"])
          .optional(),
        paidThrough: z.string().optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("saas_tenant_licenses")
      .upsert(
        {
          property_id: body.propertyId,
          tier: body.tier,
          status: body.status ?? "active",
          mrr_btn: TIER_MRR[body.tier],
          paid_through: body.paidThrough ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "property_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });

  app.post("/v1/superadmin/bypass-token", async (req) => {
    await requirePlatformAdmin(req);
    const body = z
      .object({ propertyId: z.string().uuid() })
      .parse(req.body);
    // 60 bits of CSPRNG entropy (was 4 base36 chars from Math.random — brute-forceable).
    const code = `HOS-${randomBytes(8).toString("base64url").slice(0, 10).toUpperCase()}`;
    const expires = new Date(Date.now() + 48 * 3600_000).toISOString();
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("saas_bypass_tokens")
      .insert({
        property_id: body.propertyId,
        token_code: code,
        expires_at: expires,
        created_by: `platform:${(req.user as { sub?: string }).sub ?? "unknown"}`,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { token: data.token_code, expiresAt: data.expires_at };
  });

  app.get("/v1/superadmin/marketplace-commissions", async (req) => {
    await requirePlatformAdmin(req);
    const admin = createServiceClient();
    const q = req.query as { limit?: string };
    const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
    const { data, error } = await admin
      .from("marketplace_commission_ledger")
      .select(
        "id, property_id, booking_id, market, gross_btn, commission_rate, commission_btn, currency, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { rows: data ?? [] };
  });

  app.post("/v1/superadmin/bypass-redeem", async (req) => {
    // Redeemed from the locked hotel's own desk session only.
    const jwt = await requireDeskJwt(req);
    const body = z
      .object({
        propertyId: z.string().uuid(),
        token: z.string().min(8).max(32),
      })
      .parse(req.body);
    if (body.propertyId !== jwt.propertyId) {
      throw Object.assign(new Error("Token is for a different property"), { statusCode: 403 });
    }
    const admin = createServiceClient();
    const now = new Date().toISOString();
    // Atomic consume: only one redeem can flip consumed_at.
    const { data: consumed, error } = await admin
      .from("saas_bypass_tokens")
      .update({ consumed_at: now })
      .eq("property_id", body.propertyId)
      .eq("token_code", body.token.trim().toUpperCase())
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("id");
    if (error) throw error;
    if (!consumed?.length) {
      throw Object.assign(new Error("Invalid or expired bypass token"), { statusCode: 400 });
    }
    const { error: upErr } = await admin.from("saas_tenant_licenses").upsert(
      {
        property_id: body.propertyId,
        status: "grace",
        grace_until: new Date(Date.now() + 48 * 3600_000)
          .toISOString()
          .slice(0, 10),
        updated_at: now,
      },
      { onConflict: "property_id" },
    );
    if (upErr) throw upErr;
    return { ok: true, status: "grace" };
  });
}
