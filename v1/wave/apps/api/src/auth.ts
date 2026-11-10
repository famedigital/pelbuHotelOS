import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createAnonClient,
  createServiceClient,
  DEFAULT_PROPERTY_SLUG,
} from "@hotel-os/db";
import { normalizePropertySlugInput } from "@hotel-os/core";
import { defaultPropertySlug } from "./env.js";

export type DeskJwt = {
  sub: string;
  propertyId: string;
  staffId: string;
  staffName: string;
  deskRole: string | null;
  employeeCode: string;
};

function staffAuthEmail(propertyId: string, employeeCode: string): string {
  const propertyKey = propertyId.replace(/-/g, "").slice(0, 12).toLowerCase();
  const code = employeeCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${code}.${propertyKey}@staff.pelbusuites.internal`;
}

const pinBody = z.object({
  propertySlug: z.string().min(1).optional(),
  propertyId: z.string().uuid().optional(),
  staffId: z.string().uuid(),
  pin: z.string().min(4).max(8),
});

export async function resolvePropertyId(
  slugOrId?: string,
): Promise<{ id: string; name: string; slug: string }> {
  const admin = createServiceClient();
  const fallback = defaultPropertySlug() || DEFAULT_PROPERTY_SLUG;
  const raw = (slugOrId ?? "").trim() || fallback;
  const byId = z.string().uuid().safeParse(raw);
  const key = byId.success ? raw : normalizePropertySlugInput(raw) ?? fallback;
  const byIdResolved = z.string().uuid().safeParse(key);
  const q = admin.from("properties").select("id, name, slug");
  const { data, error } = byIdResolved.success
    ? await q.eq("id", key).maybeSingle()
    : await q.eq("slug", key).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Property not found");
  return data as { id: string; name: string; slug: string };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/v1/auth/staff", async (req) => {
    const slug =
      (req.query as { propertySlug?: string }).propertySlug ||
      defaultPropertySlug();
    const property = await resolvePropertyId(slug);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("staff_members")
      .select(
        "id, full_name, employee_code, desk_role, can_login, can_access_desk, status",
      )
      .eq("property_id", property.id)
      .eq("can_login", true)
      .in("status", ["active", "on_leave"])
      .order("full_name");
    if (error) throw error;
    return {
      property,
      staff: (data ?? []).map((s) => ({
        id: s.id,
        fullName: s.full_name,
        employeeCode: s.employee_code,
        deskRole: s.desk_role,
        canAccessDesk: s.can_access_desk,
      })),
    };
  });

  app.post("/v1/auth/pin", async (req, reply) => {
    const body = pinBody.parse(req.body);
    const property = await resolvePropertyId(
      body.propertyId || body.propertySlug,
    );
    const admin = createServiceClient();
    const { data: staff, error } = await admin
      .from("staff_members")
      .select(
        "id, full_name, employee_code, desk_role, can_login, auth_user_id, property_id",
      )
      .eq("id", body.staffId)
      .eq("property_id", property.id)
      .maybeSingle();
    if (error || !staff) {
      return reply.code(401).send({ error: "Staff not found for property" });
    }
    if (!staff.can_login || !staff.auth_user_id) {
      return reply.code(401).send({ error: "Staff login is not enabled" });
    }

    const anon = createAnonClient();
    const { error: authErr } = await anon.auth.signInWithPassword({
      email: staffAuthEmail(property.id, String(staff.employee_code)),
      password: body.pin,
    });
    if (authErr) {
      return reply.code(401).send({ error: "Incorrect PIN" });
    }

    await admin
      .from("staff_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", staff.id);

    const token = await reply.jwtSign({
      sub: staff.auth_user_id,
      propertyId: property.id,
      staffId: staff.id,
      staffName: staff.full_name,
      deskRole: staff.desk_role,
      employeeCode: staff.employee_code,
    } satisfies DeskJwt);

    const role = String(staff.desk_role || "").toLowerCase();
    let homeRoute = "/desk";
    if (role === "fnb" || role === "cashier") homeRoute = "/pos";
    if (role === "kitchen") homeRoute = "/kds";
    if (role === "hk") homeRoute = "/housekeeping";
    if (role === "owner" || role === "gm") homeRoute = "/owner";

    return {
      token,
      homeRoute,
      staff: {
        id: staff.id,
        fullName: staff.full_name,
        deskRole: staff.desk_role,
        employeeCode: staff.employee_code,
      },
      property,
    };
  });
}

export async function requireDeskJwt(
  req: FastifyRequest,
): Promise<DeskJwt> {
  await req.jwtVerify();
  return req.user as DeskJwt;
}

/**
 * Platform (SaaS) operator gate. Desk staff of a hotel are NOT platform admins;
 * the staff member's Supabase auth user must be listed in platform_admins.
 */
export async function requirePlatformAdmin(req: FastifyRequest): Promise<DeskJwt> {
  const jwt = await requireDeskJwt(req);
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("id, role")
    .eq("user_id", jwt.sub)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw Object.assign(new Error("Platform admin access required"), { statusCode: 403 });
  }
  return jwt;
}
