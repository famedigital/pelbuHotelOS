import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@hotel-os/db";
import { requireDeskJwt } from "./auth.js";

export async function registerRegistryRoutes(app: FastifyInstance) {
  app.get("/v1/registry/agents", async (req) => {
    const jwt = await requireDeskJwt(req);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("agents")
      .select(
        "id, company_name, status, credit_limit, credit_used, contact_name, agent_property_links!inner(property_id, rate_tier)",
      )
      .eq("agent_property_links.property_id", jwt.propertyId)
      .order("company_name");
    if (error) throw error;
    return { agents: data ?? [] };
  });

  app.get("/v1/registry/guides", async (req) => {
    const jwt = await requireDeskJwt(req);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("guides")
      .select("id, full_name, guide_number, phone, discount_pct, visit_count, last_seen_at")
      .eq("property_id", jwt.propertyId)
      .order("full_name")
      .limit(500);
    if (error) throw error;
    return { guides: data ?? [] };
  });

  app.get("/v1/registry/fleet", async (req) => {
    const jwt = await requireDeskJwt(req);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("property_fleet_vehicles")
      .select("*")
      .eq("property_id", jwt.propertyId)
      .eq("is_active", true)
      .order("plate_number");
    if (error) throw error;
    return { vehicles: data ?? [] };
  });

  app.post("/v1/registry/fleet", async (req) => {
    const jwt = await requireDeskJwt(req);
    const body = z
      .object({
        plateNumber: z.string().min(3),
        vehicleType: z.string().default("hiace"),
        driverName: z.string().optional(),
        driverMobile: z.string().optional(),
        dormRoomLabel: z.string().optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("property_fleet_vehicles")
      .upsert(
        {
          property_id: jwt.propertyId,
          plate_number: body.plateNumber,
          vehicle_type: body.vehicleType,
          driver_name: body.driverName ?? null,
          driver_mobile: body.driverMobile ?? null,
          dorm_room_label: body.dormRoomLabel ?? null,
          is_active: true,
        },
        { onConflict: "property_id,plate_number" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });

  app.get("/v1/registry/staff", async (req) => {
    const jwt = await requireDeskJwt(req);
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("staff_members")
      .select(
        "id, full_name, employee_code, desk_role, department, status, can_login, pin_set_at",
      )
      .eq("property_id", jwt.propertyId)
      .neq("status", "terminated")
      .order("full_name");
    if (error) throw error;
    return { staff: data ?? [] };
  });

  const uuidKey = z.string().uuid();

  app.post("/v1/registry/agents", async (req) => {
    const jwt = await requireDeskJwt(req);
    const body = z
      .object({
        companyName: z.string().min(2),
        market: z.enum(["bhutan", "jaigaon", "india"]),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional().or(z.literal("")),
        notes: z.string().optional(),
        linkStatus: z.enum(["invited", "approved", "suspended"]).default("approved"),
        rateTier: z
          .enum([
            "public",
            "friends",
            "family",
            "mutual_friends",
            "agents",
            "mou_agents",
          ])
          .default("agents"),
        creditLimit: z.number().nonnegative().optional(),
        creditUsed: z.number().nonnegative().optional(),
        openRoomCap: z.number().int().nonnegative().nullable().optional(),
        idempotencyKey: uuidKey.optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const idem = body.idempotencyKey ?? randomUUID();
    const { data, error } = await admin.rpc("registry_insert_agent_and_link", {
      p_property_id: jwt.propertyId,
      p_idempotency_key: idem,
      p_company_name: body.companyName,
      p_market: body.market,
      p_contact_name: body.contactName ?? null,
      p_contact_phone: body.contactPhone ?? null,
      p_contact_email: body.contactEmail || null,
      p_notes: body.notes ?? null,
      p_link_status: body.linkStatus,
      p_link_rate_tier: body.rateTier,
      p_credit_limit: body.creditLimit ?? 0,
      p_credit_used: body.creditUsed ?? 0,
      p_open_room_cap: body.openRoomCap ?? null,
    });
    if (error) throw error;
    return data;
  });

  app.patch("/v1/registry/agents/:id", async (req) => {
    const jwt = await requireDeskJwt(req);
    const agentId = (req.params as { id: string }).id;
    const body = z
      .object({
        companyName: z.string().min(2).optional(),
        market: z.enum(["bhutan", "jaigaon", "india"]).optional(),
        contactName: z.string().nullable().optional(),
        contactPhone: z.string().nullable().optional(),
        contactEmail: z.string().email().nullable().optional(),
        notes: z.string().nullable().optional(),
        commissionPct: z.number().min(0).max(100).nullable().optional(),
        linkStatus: z.enum(["invited", "approved", "suspended"]).optional(),
        rateTier: z
          .enum([
            "public",
            "friends",
            "family",
            "mutual_friends",
            "agents",
            "mou_agents",
          ])
          .optional(),
        creditLimit: z.number().nonnegative().optional(),
        creditUsed: z.number().nonnegative().optional(),
        openRoomCap: z.number().int().nonnegative().nullable().optional(),
        idempotencyKey: uuidKey.optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const idem = body.idempotencyKey ?? randomUUID();
    const { data, error } = await admin.rpc("registry_update_agent_and_link", {
      p_property_id: jwt.propertyId,
      p_idempotency_key: idem,
      p_agent_id: agentId,
      p_company_name: body.companyName ?? null,
      p_market: body.market ?? null,
      p_contact_name:
        body.contactName === undefined ? null : body.contactName,
      p_contact_phone:
        body.contactPhone === undefined ? null : body.contactPhone,
      p_contact_email:
        body.contactEmail === undefined ? null : body.contactEmail,
      p_notes: body.notes === undefined ? null : body.notes,
      p_commission_pct:
        body.commissionPct === undefined ? null : body.commissionPct,
      p_link_status: body.linkStatus ?? null,
      p_link_rate_tier: body.rateTier ?? null,
      p_credit_limit: body.creditLimit ?? null,
      p_credit_used: body.creditUsed ?? null,
      p_open_room_cap:
        body.openRoomCap === undefined ? null : body.openRoomCap,
    });
    if (error) throw error;
    return data;
  });

  app.post("/v1/registry/guides", async (req) => {
    const jwt = await requireDeskJwt(req);
    const body = z
      .object({
        guideNumber: z.string().min(1),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        discountPct: z.number().min(0).max(100).optional(),
        idempotencyKey: uuidKey.optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const idem = body.idempotencyKey ?? randomUUID();
    const { data, error } = await admin.rpc("registry_upsert_guide", {
      p_property_id: jwt.propertyId,
      p_idempotency_key: idem,
      p_guide_number: body.guideNumber,
      p_full_name: body.fullName ?? null,
      p_phone: body.phone ?? null,
      p_notes: body.notes ?? null,
      p_discount_pct: body.discountPct ?? null,
    });
    if (error) throw error;
    return data;
  });

  const staffRoleLabels = [
    "front_desk",
    "reservation",
    "fnb",
    "kitchen",
    "housekeeping",
    "spa",
    "security",
    "maintenance",
    "manager",
    "other",
  ] as const;

  const staffDeskRoles = [
    "front_desk",
    "cashier",
    "gm",
    "hk",
    "owner",
    "fnb",
    "kitchen",
    "laundry",
    "accountant",
  ] as const;

  const staffStatuses = [
    "provisional",
    "active",
    "inactive",
    "on_leave",
    "suspended",
    "terminated",
  ] as const;

  const accessLevels = [
    "employee",
    "supervisor",
    "hr_admin",
    "payroll_admin",
    "owner",
  ] as const;

  app.post("/v1/registry/staff", async (req) => {
    const jwt = await requireDeskJwt(req);
    const body = z
      .object({
        employeeCode: z.string().min(1),
        fullName: z.string().min(2),
        roleLabel: z.enum(staffRoleLabels),
        department: z.string().optional(),
        deskRole: z.enum(staffDeskRoles).optional(),
        status: z.enum(staffStatuses).default("active"),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        accessLevel: z.enum(accessLevels).default("employee"),
        idempotencyKey: uuidKey.optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const idem = body.idempotencyKey ?? randomUUID();
    const { data, error } = await admin.rpc("registry_insert_staff", {
      p_property_id: jwt.propertyId,
      p_idempotency_key: idem,
      p_employee_code: body.employeeCode,
      p_full_name: body.fullName,
      p_role_label: body.roleLabel,
      p_department: body.department ?? null,
      p_desk_role: body.deskRole ?? null,
      p_status: body.status,
      p_phone: body.phone ?? null,
      p_email: body.email || null,
      p_access_level: body.accessLevel,
    });
    if (error) throw error;
    return data;
  });

  app.patch("/v1/registry/staff/:id", async (req) => {
    const jwt = await requireDeskJwt(req);
    const staffId = (req.params as { id: string }).id;
    const body = z
      .object({
        fullName: z.string().min(2).optional(),
        roleLabel: z.enum(staffRoleLabels).optional(),
        department: z.string().nullable().optional(),
        deskRole: z.enum(staffDeskRoles).nullable().optional(),
        status: z.enum(staffStatuses).optional(),
        phone: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        accessLevel: z.enum(accessLevels).optional(),
        idempotencyKey: uuidKey.optional(),
      })
      .parse(req.body);
    const admin = createServiceClient();
    const idem = body.idempotencyKey ?? randomUUID();
    const { data, error } = await admin.rpc("registry_update_staff", {
      p_property_id: jwt.propertyId,
      p_idempotency_key: idem,
      p_staff_id: staffId,
      p_full_name: body.fullName ?? null,
      p_role_label: body.roleLabel ?? null,
      p_department:
        body.department === undefined ? null : body.department,
      p_desk_role: body.deskRole === undefined ? null : body.deskRole,
      p_status: body.status ?? null,
      p_phone: body.phone === undefined ? null : body.phone,
      p_email: body.email === undefined ? null : body.email,
      p_access_level: body.accessLevel ?? null,
    });
    if (error) throw error;
    return data;
  });
}
