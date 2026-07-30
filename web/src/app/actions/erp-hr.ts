"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
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

function refreshHr(): void {
  revalidatePath("/erp/hr");
  revalidatePath("/staff");
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

    const record = {
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
      notes: optionalTrim(formData.get("notes")),
      updated_at: new Date().toISOString(),
    };

    let savedId: string;
    if (id) {
      const { data, error } = await admin
        .from("staff_members")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId)
        .select("id")
        .single();
      if (error || !data) throw new Error("Could not update staff member.");
      savedId = data.id as string;
    } else {
      const { data, error } = await admin
        .from("staff_members")
        .insert({ ...record, status: "active" })
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
        effective_on: record.hired_on || new Date().toISOString().slice(0, 10),
        summary: `${record.full_name} joined as ${record.position_title || role}`,
      });
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "staff.update" : "staff.create",
      entityType: "staff_members",
      entityId: savedId,
      summary: `${id ? "Updated" : "Added"} staff ${record.full_name}`,
      meta: { employeeCode, role, employmentType },
    });

    refreshHr();
    return { ok: true, message: id ? "Staff member updated." : "Staff member added." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save staff member.",
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

    refreshHr();
    return { ok: true, message: "Staff status updated." };
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
