"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type HrActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  details?: string[];
  staffId?: string;
};

const STAFF_ROLES = new Set([
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
]);

const EMPLOYMENT_TYPES = new Set([
  "full_time",
  "part_time",
  "casual",
  "contract",
  "intern",
]);

const STAFF_STATUSES = new Set([
  "active",
  "inactive",
  "on_leave",
  "suspended",
  "terminated",
]);

const ACCESS_LEVELS = new Set([
  "employee",
  "supervisor",
  "hr_admin",
  "payroll_admin",
  "owner",
]);

const DESK_ROLES = new Set([
  "front_desk",
  "cashier",
  "gm",
  "hk",
  "owner",
  "fnb",
  "kitchen",
  "laundry",
]);

const DOC_TYPES = new Set(["pass_photo", "cv", "cid", "other_id", "other"]);
const CONDUCT_KINDS = new Set(["merit", "warning"]);
const CONDUCT_SEVERITIES = new Set(["note", "low", "medium", "high", "critical"]);
const PAY_KINDS = new Set(["earning", "deduction"]);

const NOTICE_CATEGORIES = new Set([
  "company",
  "hr",
  "policy",
  "operations",
  "work_order",
  "emergency",
]);

const NOTICE_PRIORITIES = new Set(["normal", "important", "urgent"]);
const AUDIENCE_KINDS = new Set(["all", "department", "role", "selected"]);
const MAX_BULK_ROWS = 500;

async function requireHrDesk(): Promise<{
  admin: Admin;
  propertyId: string;
}> {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  const admin = createSupabaseAdminClient();
  return { admin, propertyId: await resolveActivePropertyId(admin) };
}

function refreshHr(_staffId?: string): void {
  revalidatePath("/erp/hr");
  revalidatePath("/staff");
  revalidatePath("/erp/hr/payroll");
}

function normalizeEmployeeCode(value: FormDataEntryValue | null): string {
  const code = trimRequired(value, "Employee code")
    .toUpperCase()
    .replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(code)) {
    throw new Error("Employee code must be 2–32 letters, numbers, or hyphens.");
  }
  return code;
}

function normalizeEmail(value: string | null): string | null {
  const email = value?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email: ${email}`);
  }
  return email;
}

function parseMoney(value: FormDataEntryValue | null, label: string): number | null {
  const raw = optionalTrim(value);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number.`);
  return Math.round(n * 100) / 100;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowObject(headers: string[], values: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

export async function upsertStaffMember(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = optionalTrim(formData.get("id"));
    const employeeCode = normalizeEmployeeCode(formData.get("employee_code"));
    const role = trimRequired(formData.get("role_label"), "Role").toLowerCase();
    const employmentType = (
      optionalTrim(formData.get("employment_type")) ?? "full_time"
    ).toLowerCase();
    if (!STAFF_ROLES.has(role)) throw new Error("Invalid staff role.");
    if (!EMPLOYMENT_TYPES.has(employmentType)) {
      throw new Error("Invalid employment type.");
    }

    const managerId = optionalTrim(formData.get("manager_id"));
    if (managerId) {
      const { data: manager } = await admin
        .from("staff_members")
        .select("id")
        .eq("id", managerId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (!manager) throw new Error("Manager not found on this property.");
      if (id && managerId === id) throw new Error("Staff cannot manage themselves.");
    }

    const statusRaw = optionalTrim(formData.get("status"))?.toLowerCase();
    if (statusRaw && !STAFF_STATUSES.has(statusRaw)) {
      throw new Error("Invalid staff status.");
    }

    const record: Record<string, unknown> = {
      property_id: propertyId,
      employee_code: employeeCode,
      full_name: trimRequired(formData.get("full_name"), "Name"),
      role_label: role,
      department: optionalTrim(formData.get("department")),
      position_title: optionalTrim(formData.get("position_title")),
      employment_type: employmentType,
      phone: optionalTrim(formData.get("phone")),
      email: normalizeEmail(optionalTrim(formData.get("email"))),
      hired_on: optionalTrim(formData.get("hired_on")),
      probation_ends_on: optionalTrim(formData.get("probation_ends_on")),
      contract_ends_on: optionalTrim(formData.get("contract_ends_on")),
      notes: optionalTrim(formData.get("notes")),
      manager_id: managerId,
      updated_at: new Date().toISOString(),
    };
    if (statusRaw) record.status = statusRaw;

    let savedId: string;
    if (id) {
      const { data, error } = await admin
        .from("staff_members")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId)
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23505") {
          throw new Error(`Employee code ${employeeCode} already exists.`);
        }
        throw new Error("Could not update staff member.");
      }
      savedId = data.id as string;
    } else {
      const { data, error } = await admin
        .from("staff_members")
        .insert({ ...record, status: statusRaw ?? "active" })
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23505") {
          throw new Error(`Employee code ${employeeCode} already exists.`);
        }
        throw new Error("Could not add staff member.");
      }
      savedId = data.id as string;
      await admin.from("staff_employment_events").insert({
        property_id: propertyId,
        staff_id: savedId,
        event_type: "hire",
        effective_on:
          (record.hired_on as string) || new Date().toISOString().slice(0, 10),
        summary: `${record.full_name as string} joined as ${
          (record.position_title as string) || role
        }`,
      });
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "staff.update" : "staff.create",
      entityType: "staff_members",
      entityId: savedId,
      summary: `${id ? "Updated" : "Added"} staff ${record.full_name as string}`,
      meta: { employeeCode, role, employmentType },
    });

    refreshHr(savedId);
    return {
      ok: true,
      message: id ? "Staff member updated." : "Staff member added.",
      staffId: savedId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save staff member.",
    };
  }
}

/** Roles, access level, desk gate (PIN set via setStaffPortalPin). */
export async function upsertStaffRolesAccess(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const accessLevel = (
      optionalTrim(formData.get("access_level")) ?? "employee"
    ).toLowerCase();
    const roleLabel = optionalTrim(formData.get("role_label"))?.toLowerCase();
    const deskRoleRaw = optionalTrim(formData.get("desk_role"))?.toLowerCase();
    const canAccessDesk = formData.get("can_access_desk") === "on";

    if (!ACCESS_LEVELS.has(accessLevel)) throw new Error("Invalid access level.");
    if (roleLabel && !STAFF_ROLES.has(roleLabel)) throw new Error("Invalid operational role.");
    if (deskRoleRaw && !DESK_ROLES.has(deskRoleRaw)) throw new Error("Invalid desk role.");
    if (canAccessDesk && !deskRoleRaw) {
      throw new Error("Pick a desk role when granting ERP desk access.");
    }

    const update: Record<string, unknown> = {
      access_level: accessLevel,
      can_access_desk: canAccessDesk,
      desk_role: canAccessDesk ? deskRoleRaw : null,
      updated_at: new Date().toISOString(),
    };
    if (roleLabel) update.role_label = roleLabel;

    const { data, error } = await admin
      .from("staff_members")
      .update(update)
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .select("id, full_name")
      .single();
    if (error || !data) throw new Error("Could not update access settings.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "staff.access_update",
      entityType: "staff_members",
      entityId: staffId,
      summary: `Updated access for ${data.full_name as string}`,
      meta: { accessLevel, canAccessDesk, deskRole: deskRoleRaw },
    });

    refreshHr(staffId);
    return { ok: true, message: "Access settings saved.", staffId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save access.",
    };
  }
}

/** Private wage, bank, HC, SC — money desk only. */
export async function upsertStaffPrivateProfile(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    await requireMoneyDesk();
    const { admin, propertyId } = await requireHrDesk();
    const staffId = trimRequired(formData.get("staff_id"), "Staff");

    const { data: staff } = await admin
      .from("staff_members")
      .select("id, full_name")
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!staff) throw new Error("Staff member not found.");

    const baseWage = parseMoney(formData.get("base_wage_btn"), "Base wage");
    const healthContribution = parseMoney(
      formData.get("health_contribution_btn"),
      "Health contribution",
    );
    const scShare = parseMoney(
      formData.get("service_charge_share_btn"),
      "Service charge share",
    );
    const paySchedule = (
      optionalTrim(formData.get("pay_schedule")) ?? "monthly"
    ).toLowerCase();
    if (!new Set(["monthly", "fortnightly", "weekly"]).has(paySchedule)) {
      throw new Error("Invalid pay schedule.");
    }

    const record = {
      staff_id: staffId,
      property_id: propertyId,
      cid_number: optionalTrim(formData.get("cid_number")),
      date_of_birth: optionalTrim(formData.get("date_of_birth")),
      address: optionalTrim(formData.get("address")),
      emergency_contact_name: optionalTrim(formData.get("emergency_contact_name")),
      emergency_contact_phone: optionalTrim(formData.get("emergency_contact_phone")),
      bank_name: optionalTrim(formData.get("bank_name")),
      bank_account_number: optionalTrim(formData.get("bank_account_number")),
      tax_identifier: optionalTrim(formData.get("tax_identifier")),
      provident_fund_number: optionalTrim(formData.get("provident_fund_number")),
      base_wage_btn: baseWage,
      health_contribution_btn: healthContribution,
      service_charge_eligible: formData.get("service_charge_eligible") === "on",
      service_charge_share_btn: scShare,
      photo_public_id: optionalTrim(formData.get("photo_public_id")),
      pay_schedule: paySchedule,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from("staff_private_profiles")
      .upsert(record, { onConflict: "staff_id" });
    if (error) {
      console.error("staff_private_profiles upsert failed", error);
      throw new Error("Could not save compensation profile.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "staff.private_profile_upsert",
      entityType: "staff_private_profiles",
      entityId: staffId,
      summary: `Updated private profile for ${staff.full_name as string}`,
      meta: {
        hasWage: baseWage != null,
        scEligible: record.service_charge_eligible,
      },
    });

    refreshHr(staffId);
    return { ok: true, message: "Compensation profile saved.", staffId };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not save private profile.",
    };
  }
}

export async function upsertStaffPayComponent(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    await requireMoneyDesk();
    const { admin, propertyId } = await requireHrDesk();
    const id = optionalTrim(formData.get("id"));
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const kind = trimRequired(formData.get("kind"), "Kind").toLowerCase();
    if (!PAY_KINDS.has(kind)) throw new Error("Invalid pay component kind.");
    const amount = parseMoney(formData.get("amount_btn"), "Amount");
    if (amount == null) throw new Error("Amount is required.");

    const record = {
      property_id: propertyId,
      staff_id: staffId,
      kind,
      code: trimRequired(formData.get("code"), "Code").toUpperCase().replace(/\s+/g, "_"),
      label: trimRequired(formData.get("label"), "Label"),
      amount_btn: amount,
      taxable: formData.get("taxable") === "on" || formData.get("taxable") === "true",
      is_active: formData.get("is_active") !== "off",
      effective_from:
        optionalTrim(formData.get("effective_from")) ??
        new Date().toISOString().slice(0, 10),
      effective_to: optionalTrim(formData.get("effective_to")),
      notes: optionalTrim(formData.get("notes")),
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await admin
        .from("staff_pay_components")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not update pay component.");
    } else {
      const { error } = await admin.from("staff_pay_components").insert(record);
      if (error) {
        if (error.code === "23505") {
          throw new Error("An active component with this code already exists.");
        }
        throw new Error("Could not add pay component.");
      }
    }

    refreshHr(staffId);
    return { ok: true, message: "Pay component saved.", staffId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save pay component.",
    };
  }
}

export async function deleteStaffPayComponent(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    await requireMoneyDesk();
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("id"), "Component");
    const staffId = optionalTrim(formData.get("staff_id"));
    const { error } = await admin
      .from("staff_pay_components")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not delete pay component.");
    refreshHr(staffId ?? undefined);
    return { ok: true, message: "Pay component removed.", staffId: staffId ?? undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete component.",
    };
  }
}

/** One file each for pass photo / CV so directory photos and dossiers stay clean. */
const EXCLUSIVE_DOC_TYPES = new Set(["pass_photo", "cv"]);

async function syncPassPhotoToProfile(
  admin: Admin,
  propertyId: string,
  staffId: string,
  publicId: string | null,
): Promise<void> {
  const { data: existingProfile } = await admin
    .from("staff_private_profiles")
    .select("staff_id")
    .eq("staff_id", staffId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (existingProfile) {
    await admin
      .from("staff_private_profiles")
      .update({
        photo_public_id: publicId,
        updated_at: new Date().toISOString(),
      })
      .eq("staff_id", staffId)
      .eq("property_id", propertyId);
    return;
  }
  if (publicId) {
    await admin.from("staff_private_profiles").insert({
      staff_id: staffId,
      property_id: propertyId,
      photo_public_id: publicId,
    });
  }
}

export async function upsertStaffDocument(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = optionalTrim(formData.get("id"));
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const docType = trimRequired(formData.get("doc_type"), "Document type").toLowerCase();
    if (!DOC_TYPES.has(docType)) throw new Error("Invalid document type.");
    const publicId = trimRequired(formData.get("cloudinary_public_id"), "Cloudinary asset");
    const title =
      optionalTrim(formData.get("title")) ??
      (docType === "pass_photo"
        ? "Pass photo"
        : docType === "cv"
          ? "CV"
          : docType === "cid"
            ? "CID"
            : docType === "other_id"
              ? "ID document"
              : "Document");

    const record = {
      property_id: propertyId,
      staff_id: staffId,
      doc_type: docType,
      title,
      cloudinary_public_id: publicId,
      resource_type: optionalTrim(formData.get("resource_type")) ?? "image",
      notes: optionalTrim(formData.get("notes")),
      updated_at: new Date().toISOString(),
    };

    let targetId = id;
    if (!targetId && EXCLUSIVE_DOC_TYPES.has(docType)) {
      const { data: existing } = await admin
        .from("staff_documents")
        .select("id")
        .eq("property_id", propertyId)
        .eq("staff_id", staffId)
        .eq("doc_type", docType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetId = existing?.id ?? undefined;
    }

    if (targetId) {
      const { error } = await admin
        .from("staff_documents")
        .update(record)
        .eq("id", targetId)
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not update document.");
    } else {
      const { error } = await admin.from("staff_documents").insert(record);
      if (error) throw new Error("Could not add document.");
    }

    if (docType === "pass_photo") {
      await syncPassPhotoToProfile(admin, propertyId, staffId, publicId);
    }

    refreshHr(staffId);
    return { ok: true, message: "Document saved.", staffId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save document.",
    };
  }
}

export async function deleteStaffDocument(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("id"), "Document");
    const { data: existing, error: loadError } = await admin
      .from("staff_documents")
      .select("id, staff_id, doc_type, cloudinary_public_id")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (loadError || !existing) throw new Error("Document not found.");
    const staffId = existing.staff_id as string;

    const { error } = await admin
      .from("staff_documents")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not delete document.");

    if (existing.doc_type === "pass_photo") {
      const { data: nextPhoto } = await admin
        .from("staff_documents")
        .select("cloudinary_public_id")
        .eq("property_id", propertyId)
        .eq("staff_id", staffId)
        .eq("doc_type", "pass_photo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      await syncPassPhotoToProfile(
        admin,
        propertyId,
        staffId,
        (nextPhoto?.cloudinary_public_id as string | undefined) ?? null,
      );
    }

    refreshHr(staffId);
    return { ok: true, message: "Document removed.", staffId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete document.",
    };
  }
}

export async function upsertStaffConductRecord(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = optionalTrim(formData.get("id"));
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const kind = trimRequired(formData.get("kind"), "Kind").toLowerCase();
    const severity = (
      optionalTrim(formData.get("severity")) ?? "note"
    ).toLowerCase();
    if (!CONDUCT_KINDS.has(kind)) throw new Error("Invalid conduct kind.");
    if (!CONDUCT_SEVERITIES.has(severity)) throw new Error("Invalid severity.");

    const record = {
      property_id: propertyId,
      staff_id: staffId,
      kind,
      severity,
      title: trimRequired(formData.get("title"), "Title"),
      body: optionalTrim(formData.get("body")),
      recorded_on:
        optionalTrim(formData.get("recorded_on")) ??
        new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await admin
        .from("staff_conduct_records")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not update conduct record.");
    } else {
      const { error } = await admin.from("staff_conduct_records").insert(record);
      if (error) throw new Error("Could not add conduct record.");
    }

    refreshHr(staffId);
    return { ok: true, message: "Conduct record saved.", staffId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save record.",
    };
  }
}

export async function deleteStaffConductRecord(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("id"), "Record");
    const staffId = optionalTrim(formData.get("staff_id"));
    const { error } = await admin
      .from("staff_conduct_records")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not delete conduct record.");
    refreshHr(staffId ?? undefined);
    return { ok: true, message: "Conduct record removed.", staffId: staffId ?? undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete record.",
    };
  }
}

export async function changeStaffStatus(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("staff_id"), "Staff");
    const status = trimRequired(formData.get("status"), "Status").toLowerCase();
    const reason = trimRequired(formData.get("reason"), "Reason");
    if (!STAFF_STATUSES.has(status)) throw new Error("Invalid staff status.");

    const { data: staff, error } = await admin
      .from("staff_members")
      .update({
        status,
        ended_on: status === "terminated" ? new Date().toISOString().slice(0, 10) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id, full_name")
      .single();
    if (error || !staff) throw new Error("Could not update staff status.");

    const eventType =
      status === "terminated"
        ? "termination"
        : status === "suspended"
          ? "suspension"
          : status === "active"
            ? "reactivation"
            : "note";
    await admin.from("staff_employment_events").insert({
      property_id: propertyId,
      staff_id: id,
      event_type: eventType,
      summary: reason,
      details: { status },
    });
    await writeAuditEvent(admin, {
      propertyId,
      action: "staff.status_change",
      entityType: "staff_members",
      entityId: id,
      summary: `${staff.full_name as string} changed to ${status}`,
      meta: { status, reason },
    });

    refreshHr(id);
    return { ok: true, message: "Staff status updated.", staffId: id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update status.",
    };
  }
}

export async function importStaffCsv(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a CSV file.");
    }
    if (file.size > 1_000_000) throw new Error("CSV must be smaller than 1 MB.");

    const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
    if (rows.length < 2) throw new Error("CSV has no staff rows.");
    if (rows.length - 1 > MAX_BULK_ROWS) {
      throw new Error(`Import is limited to ${MAX_BULK_ROWS} staff at a time.`);
    }

    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const required = ["employee_code", "full_name", "role_label"];
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}.`);

    const errors: string[] = [];
    const records: Record<string, string | null>[] = [];
    const seen = new Set<string>();

    rows.slice(1).forEach((values, index) => {
      try {
        const input = rowObject(headers, values);
        const employeeCode = normalizeEmployeeCode(input.employee_code);
        const role = input.role_label.toLowerCase();
        const employmentType = (input.employment_type || "full_time").toLowerCase();
        if (seen.has(employeeCode)) throw new Error("duplicate employee code in file");
        if (!STAFF_ROLES.has(role)) throw new Error(`invalid role "${role}"`);
        if (!EMPLOYMENT_TYPES.has(employmentType)) {
          throw new Error(`invalid employment type "${employmentType}"`);
        }
        seen.add(employeeCode);
        records.push({
          property_id: propertyId,
          employee_code: employeeCode,
          full_name: input.full_name.trim(),
          role_label: role,
          department: input.department?.trim() || null,
          position_title: input.position_title?.trim() || null,
          employment_type: employmentType,
          phone: input.phone?.trim() || null,
          email: normalizeEmail(input.email || null),
          hired_on: input.hired_on?.trim() || null,
          status: "active",
          updated_at: new Date().toISOString(),
        });
        if (!input.full_name.trim()) throw new Error("full_name is required");
      } catch (error) {
        errors.push(
          `Row ${index + 2}: ${error instanceof Error ? error.message : "invalid row"}`,
        );
      }
    });

    if (errors.length) {
      return {
        ok: false,
        error: `Nothing imported. Fix ${errors.length} row error${errors.length === 1 ? "" : "s"}.`,
        details: errors.slice(0, 20),
      };
    }

    const { error } = await admin
      .from("staff_members")
      .upsert(records, { onConflict: "property_id,employee_code" });
    if (error) throw new Error("Could not import staff CSV.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "staff.bulk_upsert",
      entityType: "staff_members",
      summary: `Bulk imported ${records.length} staff`,
      meta: { count: records.length, filename: file.name },
    });

    refreshHr();
    return { ok: true, message: `${records.length} staff imported or updated.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not import CSV.",
    };
  }
}

async function audienceStaff(
  admin: Admin,
  propertyId: string,
  kind: string,
  value: string | null,
): Promise<Array<{ id: string; email: string | null }>> {
  let query = admin
    .from("staff_members")
    .select("id, email")
    .eq("property_id", propertyId)
    .in("status", ["active", "on_leave"]);

  if (kind === "department") query = query.eq("department", value);
  if (kind === "role") query = query.eq("role_label", value);
  if (kind === "selected") {
    const ids = (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) throw new Error("Select at least one staff member.");
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not resolve notice audience.");
  return (data ?? []) as Array<{ id: string; email: string | null }>;
}

export async function createHrAnnouncement(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const title = trimRequired(formData.get("title"), "Title");
    const body = trimRequired(formData.get("body"), "Message");
    const category = trimRequired(formData.get("category"), "Category").toLowerCase();
    const priority = trimRequired(formData.get("priority"), "Priority").toLowerCase();
    const audienceKind = trimRequired(
      formData.get("audience_kind"),
      "Audience",
    ).toLowerCase();
    const audienceValue =
      audienceKind === "all"
        ? null
        : audienceKind === "selected"
          ? formData
              .getAll("selected_staff_ids")
              .map(String)
              .map((id) => id.trim())
              .filter(Boolean)
              .join(",")
          : optionalTrim(formData.get("audience_value"));
    const publishNow = formData.get("publish_now") === "on";
    const requiresAcknowledgement = formData.get("requires_acknowledgement") === "on";
    const isPinned = formData.get("is_pinned") === "on";

    if (!NOTICE_CATEGORIES.has(category)) throw new Error("Invalid notice category.");
    if (!NOTICE_PRIORITIES.has(priority)) throw new Error("Invalid notice priority.");
    if (!AUDIENCE_KINDS.has(audienceKind)) throw new Error("Invalid notice audience.");
    if (audienceKind !== "all" && !audienceValue) {
      throw new Error("Audience value is required.");
    }

    const recipients = publishNow
      ? await audienceStaff(admin, propertyId, audienceKind, audienceValue)
      : [];
    if (publishNow && recipients.length === 0) {
      throw new Error("No active staff match this audience.");
    }

    const now = new Date().toISOString();
    const { data: notice, error } = await admin
      .from("hr_announcements")
      .insert({
        property_id: propertyId,
        title,
        body,
        category,
        priority,
        audience_kind: audienceKind,
        audience_value: audienceValue,
        requires_acknowledgement: requiresAcknowledgement,
        is_pinned: isPinned,
        status: publishNow ? "published" : "draft",
        published_at: publishNow ? now : null,
      })
      .select("id")
      .single();
    if (error || !notice) throw new Error("Could not save notice.");

    if (publishNow) {
      const receiptRows = recipients.map((staff) => ({
        announcement_id: notice.id,
        property_id: propertyId,
        staff_id: staff.id,
      }));
      const outboxRows = recipients.flatMap((staff) => {
        const base = {
          property_id: propertyId,
          staff_id: staff.id,
          announcement_id: notice.id,
          event_type: "announcement.published",
          payload: { title, category, priority, url: `/staff/notices/${notice.id}` },
        };
        return [
          {
            ...base,
            channel: "in_app",
            idempotency_key: `${notice.id}:${staff.id}:in_app`,
          },
          {
            ...base,
            channel: "web_push",
            idempotency_key: `${notice.id}:${staff.id}:web_push`,
          },
          ...(staff.email
            ? [
                {
                  ...base,
                  channel: "email",
                  idempotency_key: `${notice.id}:${staff.id}:email`,
                  payload: { ...base.payload, email: staff.email },
                },
              ]
            : []),
        ];
      });

      const [{ error: receiptError }, { error: outboxError }] = await Promise.all([
        admin.from("hr_announcement_recipients").insert(receiptRows),
        admin.from("hr_notification_outbox").insert(outboxRows),
      ]);
      if (receiptError || outboxError) {
        await admin.from("hr_announcements").delete().eq("id", notice.id);
        throw new Error("Notice recipients could not be created.");
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: publishNow ? "announcement.publish" : "announcement.draft",
      entityType: "hr_announcements",
      entityId: notice.id as string,
      summary: `${publishNow ? "Published" : "Drafted"} notice: ${title}`,
      meta: {
        category,
        priority,
        audienceKind,
        recipientCount: recipients.length,
        requiresAcknowledgement,
      },
    });

    refreshHr();
    return {
      ok: true,
      message: publishNow
        ? `Notice published to ${recipients.length} staff.`
        : "Notice saved as draft.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save notice.",
    };
  }
}

export async function reviewStaffLeave(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const leaveId = trimRequired(formData.get("leave_id"), "Leave request");
    const decision = trimRequired(formData.get("decision"), "Decision").toLowerCase();
    const notes = optionalTrim(formData.get("decision_notes"));
    if (!new Set(["approved", "denied", "cancelled"]).has(decision)) {
      throw new Error("Invalid leave decision.");
    }

    const { data, error } = await admin
      .from("staff_leave")
      .update({
        status: decision,
        decision_notes: notes,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leaveId)
      .eq("property_id", propertyId)
      .eq("status", "requested")
      .select("id, staff_id")
      .single();
    if (error || !data) throw new Error("Leave request is no longer pending.");

    await writeAuditEvent(admin, {
      propertyId,
      action: `leave.${decision}`,
      entityType: "staff_leave",
      entityId: leaveId,
      summary: `Leave request ${decision}`,
      meta: { staffId: data.staff_id, notes },
    });

    refreshHr();
    return { ok: true, message: `Leave ${decision}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not review leave.",
    };
  }
}
