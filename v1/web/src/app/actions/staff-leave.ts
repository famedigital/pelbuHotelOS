"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  addMonths,
  calculateRequestedLeaveDays,
  currentPolicy,
  eachMonth,
  leaveCoverageWarnings,
} from "@/lib/leave";
import { resolveActivePropertyId } from "@/lib/property-context";
import { requireStaffSession } from "@/lib/staff-auth";
import { processStaffNotificationOutbox } from "@/lib/staff-notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type LeaveActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  warnings?: string[];
};

function refreshLeave(): void {
  revalidatePath("/staff");
  revalidatePath("/staff/leave");
  revalidatePath("/erp/hr");
  revalidatePath("/erp/hr/leave");
}

function isoDate(value: FormDataEntryValue | null, label: string): string {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${label} must be a valid date.`);
  }
  return text;
}

function period(value: FormDataEntryValue | null): "full" | "am" | "pm" {
  const text = String(value ?? "full");
  if (!["full", "am", "pm"].includes(text)) throw new Error("Invalid day period.");
  return text as "full" | "am" | "pm";
}

function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth()
  );
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function syncStaffAccruals(
  admin: Admin,
  propertyId: string,
  staff: {
    id: string;
    hired_on: string | null;
    probation_ends_on: string | null;
  },
  throughDate: string,
): Promise<number> {
  if (!staff.hired_on) return 0;
  const { data: policies } = await admin
    .from("hr_leave_policies")
    .select(
      "id, code, accrual_frequency, accrual_days, minimum_service_months, starts_after_probation, effective_from, effective_to",
    )
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .lte("effective_from", throughDate)
    .or(`effective_to.is.null,effective_to.gte.${throughDate}`);

  const rows: Array<Record<string, unknown>> = [];
  for (const policy of policies ?? []) {
    if (!["monthly", "annual"].includes(policy.accrual_frequency as string)) continue;
    let eligibility = addMonths(
      staff.hired_on,
      Number(policy.minimum_service_months ?? 0),
    );
    if (
      policy.starts_after_probation &&
      staff.probation_ends_on &&
      staff.probation_ends_on > eligibility
    ) {
      eligibility = staff.probation_ends_on;
    }
    if (eligibility > throughDate) continue;

    if (policy.accrual_frequency === "monthly") {
      for (const month of eachMonth(eligibility, throughDate)) {
        rows.push({
          property_id: propertyId,
          staff_id: staff.id,
          leave_policy_id: policy.id,
          transaction_date: `${month}-01`,
          transaction_kind: "accrual",
          days: Number(policy.accrual_days),
          idempotency_key: `accrual:${staff.id}:${policy.id}:${month}`,
          notes: `Monthly ${policy.code as string} accrual`,
          created_by: "system",
        });
      }
    } else {
      const startYear = Number(eligibility.slice(0, 4));
      const endYear = Number(throughDate.slice(0, 4));
      for (let year = startYear; year <= endYear; year += 1) {
        rows.push({
          property_id: propertyId,
          staff_id: staff.id,
          leave_policy_id: policy.id,
          transaction_date: `${year}-01-01`,
          transaction_kind: "accrual",
          days: Number(policy.accrual_days),
          idempotency_key: `accrual:${staff.id}:${policy.id}:${year}`,
          notes: `Annual ${policy.code as string} accrual`,
          created_by: "system",
        });
      }
    }
  }

  if (rows.length) {
    const { error } = await admin
      .from("hr_leave_ledger")
      .upsert(rows, { onConflict: "property_id,idempotency_key", ignoreDuplicates: true });
    if (error) throw new Error("Could not refresh leave accruals.");
  }
  return rows.length;
}

async function uploadLeaveAttachment(
  admin: Admin,
  input: {
    file: File;
    propertyId: string;
    staffId: string;
    leaveId: string;
  },
): Promise<void> {
  if (input.file.size === 0) return;
  if (input.file.size > 10 * 1024 * 1024) {
    throw new Error("Attachment must be 10 MB or smaller.");
  }
  const allowed = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  if (!allowed.has(input.file.type)) {
    throw new Error("Attachment must be a PDF, JPG, PNG, or WebP file.");
  }
  const extension = input.file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${input.propertyId}/leave/${input.staffId}/${input.leaveId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from("hr-private")
    .upload(path, await input.file.arrayBuffer(), {
      contentType: input.file.type,
      upsert: false,
    });
  if (uploadError) throw new Error("Could not upload leave evidence.");

  const { error: metadataError } = await admin.from("hr_leave_attachments").insert({
    property_id: input.propertyId,
    staff_id: input.staffId,
    leave_id: input.leaveId,
    storage_path: path,
    file_name: input.file.name.slice(0, 255),
    content_type: input.file.type,
    size_bytes: input.file.size,
  });
  if (metadataError) {
    await admin.storage.from("hr-private").remove([path]);
    throw new Error("Could not save leave attachment.");
  }
}

export async function requestOwnLeave(
  _previous: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  try {
    const session = await requireStaffSession();
    const admin = createSupabaseAdminClient();
    const startsOn = isoDate(formData.get("starts_on"), "Start date");
    const endsOn = isoDate(formData.get("ends_on"), "End date");
    if (endsOn < startsOn) throw new Error("End date must be on or after start date.");
    const policyId = String(formData.get("leave_policy_id") ?? "").trim();
    const selectedPolicy = await currentPolicy(
      admin,
      session.propertyId,
      policyId,
      startsOn,
    );
    const startPeriod = period(formData.get("start_period"));
    const endPeriod = period(formData.get("end_period"));
    if (!selectedPolicy.allow_half_day && (startPeriod !== "full" || endPeriod !== "full")) {
      throw new Error("This leave policy does not allow half-days.");
    }

    const { data: staff } = await admin
      .from("staff_members")
      .select("id, department, manager_id, hired_on, probation_ends_on")
      .eq("id", session.staffId)
      .eq("property_id", session.propertyId)
      .single();
    if (!staff) throw new Error("Staff record not found.");
    if (
      selectedPolicy.minimum_service_months > 0 &&
      (!staff.hired_on ||
        monthsBetween(staff.hired_on as string, startsOn) <
          selectedPolicy.minimum_service_months)
    ) {
      throw new Error(
        `${selectedPolicy.name} requires ${selectedPolicy.minimum_service_months} months of service.`,
      );
    }
    if (
      selectedPolicy.starts_after_probation &&
      staff.probation_ends_on &&
      startsOn < (staff.probation_ends_on as string)
    ) {
      throw new Error(`${selectedPolicy.name} starts after probation.`);
    }

    const requestedDays = await calculateRequestedLeaveDays(admin, {
      propertyId: session.propertyId,
      staffId: session.staffId,
      policy: selectedPolicy,
      startsOn,
      endsOn,
      startPeriod,
      endPeriod,
    });
    const attachment = formData.get("attachment");
    if (
      selectedPolicy.evidence_after_days != null &&
      requestedDays >= selectedPolicy.evidence_after_days &&
      (!(attachment instanceof File) || attachment.size === 0)
    ) {
      throw new Error(`Evidence is required for this ${selectedPolicy.name} request.`);
    }

    const warnings = await leaveCoverageWarnings(admin, {
      propertyId: session.propertyId,
      staffId: session.staffId,
      policyId,
      department: (staff.department as string | null) ?? null,
      startsOn,
      endsOn,
    });
    const today = new Date().toISOString().slice(0, 10);
    if (
      selectedPolicy.notice_days > 0 &&
      startsOn < addDays(today, selectedPolicy.notice_days)
    ) {
      warnings.push(
        `${selectedPolicy.name} normally requires ${selectedPolicy.notice_days} calendar days’ notice.`,
      );
    }
    const stage = staff.manager_id ? "supervisor_review" : "hr_review";
    const { data: leave, error } = await admin
      .from("staff_leave")
      .insert({
        property_id: session.propertyId,
        staff_id: session.staffId,
        leave_policy_id: policyId,
        leave_type: selectedPolicy.code,
        starts_on: startsOn,
        ends_on: endsOn,
        start_period: startPeriod,
        end_period: endPeriod,
        requested_days: requestedDays,
        status: "requested",
        approval_stage: stage,
        notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
        coverage_warnings: warnings,
        payroll_impact:
          selectedPolicy.paid_rate === 1
            ? "paid"
            : selectedPolicy.paid_rate === 0
              ? "unpaid"
              : "partial",
      })
      .select("id")
      .single();
    if (error || !leave) throw new Error("Could not submit leave request.");

    try {
      if (attachment instanceof File && attachment.size > 0) {
        await uploadLeaveAttachment(admin, {
          file: attachment,
          propertyId: session.propertyId,
          staffId: session.staffId,
          leaveId: leave.id as string,
        });
      }
    } catch (error) {
      await admin.from("staff_leave").delete().eq("id", leave.id);
      throw error;
    }

    await writeAuditEvent(admin, {
      propertyId: session.propertyId,
      action: "leave.request",
      entityType: "staff_leave",
      entityId: leave.id as string,
      summary: `${session.fullName} requested ${requestedDays} day(s) ${selectedPolicy.name}`,
      actor: session.employeeCode,
      meta: { startsOn, endsOn, policyCode: selectedPolicy.code, warnings },
    });

    refreshLeave();
    return {
      ok: true,
      message: `Leave request submitted for ${requestedDays} day${requestedDays === 1 ? "" : "s"}.`,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not request leave.",
    };
  }
}

export async function cancelOwnLeave(formData: FormData): Promise<void> {
  const session = await requireStaffSession();
  const leaveId = String(formData.get("leave_id") ?? "").trim();
  if (!leaveId) throw new Error("Missing leave request.");
  const reason = String(formData.get("reason") ?? "Cancelled by employee")
    .trim()
    .slice(0, 500);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("staff_leave")
    .update({
      status: "cancelled",
      approval_stage: "completed",
      cancelled_at: now,
      cancellation_reason: reason,
      updated_at: now,
    })
    .eq("id", leaveId)
    .eq("property_id", session.propertyId)
    .eq("staff_id", session.staffId)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new Error("Only pending leave requests can be cancelled here.");
  }

  await writeAuditEvent(admin, {
    propertyId: session.propertyId,
    action: "leave.cancel",
    entityType: "staff_leave",
    entityId: leaveId,
    summary: `${session.fullName} cancelled a pending leave request`,
    actor: session.employeeCode,
    meta: { reason },
  });
  refreshLeave();
}

async function enqueueLeaveDecision(
  admin: Admin,
  input: {
    propertyId: string;
    staffId: string;
    leaveId: string;
    decision: string;
    email: string | null;
  },
): Promise<void> {
  const title = `Leave request ${input.decision}`;
  const base = {
    property_id: input.propertyId,
    staff_id: input.staffId,
    event_type: `leave.${input.decision}`,
    payload: { title, category: "leave", url: "/staff/leave" },
  };
  const batch = Date.now();
  await admin.from("hr_notification_outbox").insert([
    {
      ...base,
      channel: "in_app",
      idempotency_key: `leave:${input.leaveId}:${input.decision}:in_app:${batch}`,
    },
    {
      ...base,
      channel: "web_push",
      idempotency_key: `leave:${input.leaveId}:${input.decision}:push:${batch}`,
    },
    ...(input.email
      ? [
          {
            ...base,
            channel: "email",
            payload: { ...base.payload, email: input.email },
            idempotency_key: `leave:${input.leaveId}:${input.decision}:email:${batch}`,
          },
        ]
      : []),
  ]);
}

export async function reviewTeamLeave(
  _previous: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  try {
    const session = await requireStaffSession();
    if (!["supervisor", "hr_admin", "owner"].includes(session.accessLevel)) {
      throw new Error("Supervisor access is required.");
    }
    const leaveId = String(formData.get("leave_id") ?? "").trim();
    const decision = String(formData.get("decision") ?? "").trim();
    const notes = String(formData.get("decision_notes") ?? "").trim().slice(0, 2000);
    if (!["approved", "denied"].includes(decision)) {
      throw new Error("Invalid leave decision.");
    }

    const admin = createSupabaseAdminClient();
    const { data: leave } = await admin
      .from("staff_leave")
      .select(
        "id, staff_id, staff_members!inner(full_name, email, manager_id)",
      )
      .eq("id", leaveId)
      .eq("property_id", session.propertyId)
      .eq("status", "requested")
      .eq("approval_stage", "supervisor_review")
      .maybeSingle();
    const related = leave?.staff_members as
      | { full_name: string; email: string | null; manager_id: string | null }
      | Array<{ full_name: string; email: string | null; manager_id: string | null }>
      | null;
    const staff = Array.isArray(related) ? related[0] : related;
    if (!leave || !staff) throw new Error("Team leave request not found.");
    if (
      session.accessLevel === "supervisor" &&
      staff.manager_id !== session.staffId
    ) {
      throw new Error("This employee is not assigned to you.");
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("staff_leave")
      .update({
        supervisor_decision: decision,
        supervisor_reviewed_at: now,
        supervisor_reviewed_by_staff_id: session.staffId,
        supervisor_notes: notes || null,
        approval_stage: decision === "approved" ? "hr_review" : "completed",
        status: decision === "denied" ? "denied" : "requested",
        updated_at: now,
      })
      .eq("id", leaveId)
      .eq("status", "requested")
      .eq("approval_stage", "supervisor_review");
    if (error) throw new Error("Could not review team leave.");

    await writeAuditEvent(admin, {
      propertyId: session.propertyId,
      action: `leave.supervisor_${decision}`,
      entityType: "staff_leave",
      entityId: leaveId,
      summary: `${session.fullName} ${decision} leave for ${staff.full_name}`,
      actor: session.employeeCode,
      meta: { notes },
    });
    if (decision === "denied") {
      await enqueueLeaveDecision(admin, {
        propertyId: session.propertyId,
        staffId: leave.staff_id as string,
        leaveId,
        decision: "denied",
        email: staff.email,
      });
      await processStaffNotificationOutbox();
    }

    refreshLeave();
    revalidatePath("/staff/leave/team");
    return {
      ok: true,
      message:
        decision === "approved"
          ? "Approved and sent to HR."
          : "Leave request denied.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not review leave.",
    };
  }
}

export async function reviewLeaveStage(
  _previous: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const leaveId = String(formData.get("leave_id") ?? "").trim();
    const decision = String(formData.get("decision") ?? "").trim();
    const notes = String(formData.get("decision_notes") ?? "").trim().slice(0, 2000);
    if (!["approved", "denied"].includes(decision)) {
      throw new Error("Invalid leave decision.");
    }

    const { data: leave } = await admin
      .from("staff_leave")
      .select(
        "id, staff_id, leave_policy_id, leave_type, requested_days, starts_on, status, approval_stage, staff_members(id, full_name, email, hired_on, probation_ends_on)",
      )
      .eq("id", leaveId)
      .eq("property_id", propertyId)
      .eq("status", "requested")
      .maybeSingle();
    if (!leave) throw new Error("Leave request is no longer pending.");
    type RelatedStaff = {
      id: string;
      full_name: string;
      email: string | null;
      hired_on: string | null;
      probation_ends_on: string | null;
    };
    const related = leave.staff_members as RelatedStaff | RelatedStaff[] | null;
    const staff = Array.isArray(related) ? related[0] : related;
    if (!staff || typeof staff !== "object" || !("id" in staff)) {
      throw new Error("Staff record not found.");
    }

    if (leave.approval_stage === "supervisor_review") {
      await admin
        .from("staff_leave")
        .update({
          supervisor_decision: decision,
          supervisor_reviewed_at: new Date().toISOString(),
          supervisor_notes: notes || null,
          approval_stage: decision === "approved" ? "hr_review" : "completed",
          status: decision === "denied" ? "denied" : "requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveId);

      await writeAuditEvent(admin, {
        propertyId,
        action: `leave.supervisor_${decision}`,
        entityType: "staff_leave",
        entityId: leaveId,
        summary: `Supervisor ${decision} leave for ${staff.full_name}`,
        meta: { notes },
      });

      if (decision === "denied") {
        await enqueueLeaveDecision(admin, {
          propertyId,
          staffId: leave.staff_id as string,
          leaveId,
          decision: "denied",
          email: staff.email,
        });
        await processStaffNotificationOutbox();
      }
      refreshLeave();
      return {
        ok: true,
        message:
          decision === "approved"
            ? "Supervisor approved; sent to HR for final review."
            : "Leave denied.",
      };
    }

    if (decision === "approved") {
      const policy = await currentPolicy(
        admin,
        propertyId,
        leave.leave_policy_id as string,
        leave.starts_on as string,
      );
      await syncStaffAccruals(
        admin,
        propertyId,
        {
          id: staff.id,
          hired_on: staff.hired_on,
          probation_ends_on: staff.probation_ends_on,
        },
        leave.starts_on as string,
      );
      const requestedDays = Number(leave.requested_days);

      let eventGrantDays: number | null = null;
      if (policy.accrual_frequency === "event") {
        const { count } = await admin
          .from("staff_leave")
          .select("id", { count: "exact", head: true })
          .eq("property_id", propertyId)
          .eq("staff_id", staff.id)
          .eq("leave_policy_id", policy.id)
          .eq("status", "approved");
        if (
          policy.lifetime_occurrence_limit != null &&
          (count ?? 0) >= policy.lifetime_occurrence_limit
        ) {
          throw new Error(`${policy.name} lifetime occurrence limit has been reached.`);
        }
        if (requestedDays > policy.accrual_days) {
          throw new Error(`${policy.name} is limited to ${policy.accrual_days} days.`);
        }
        eventGrantDays = policy.accrual_days;
      } else if (policy.accrual_frequency !== "none") {
        const { data: balance } = await admin
          .from("hr_leave_balances")
          .select("balance_days")
          .eq("staff_id", staff.id)
          .eq("leave_policy_id", policy.id)
          .maybeSingle();
        if (Number(balance?.balance_days ?? 0) < requestedDays) {
          throw new Error(
            `Insufficient ${policy.name} balance. Available: ${Number(balance?.balance_days ?? 0).toFixed(1)} days.`,
          );
        }
      }

      if (policy.accrual_frequency !== "none") {
        const ledgerRows = [
          ...(eventGrantDays == null
            ? []
            : [
                {
                  property_id: propertyId,
                  staff_id: staff.id,
                  leave_policy_id: policy.id,
                  leave_id: leaveId,
                  transaction_date: leave.starts_on,
                  transaction_kind: "opening",
                  days: eventGrantDays,
                  idempotency_key: `event-grant:${leaveId}`,
                  notes: `${policy.name} entitlement grant`,
                  created_by: "hr",
                },
              ]),
          {
            property_id: propertyId,
            staff_id: staff.id,
            leave_policy_id: policy.id,
            leave_id: leaveId,
            transaction_date: leave.starts_on,
            transaction_kind: "taken",
            days: -requestedDays,
            idempotency_key: `leave-taken:${leaveId}`,
            notes: `Approved ${policy.name}`,
            created_by: "hr",
          },
        ];
        const { error: ledgerError } = await admin
          .from("hr_leave_ledger")
          .insert(ledgerRows);
        if (ledgerError) throw new Error("Could not post leave to the balance ledger.");
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("staff_leave")
      .update({
        status: decision,
        approval_stage: "completed",
        reviewed_at: now,
        decision_notes: notes || null,
        updated_at: now,
      })
      .eq("id", leaveId)
      .eq("status", "requested");
    if (updateError) throw new Error("Could not finalize leave decision.");

    await writeAuditEvent(admin, {
      propertyId,
      action: `leave.hr_${decision}`,
      entityType: "staff_leave",
      entityId: leaveId,
      summary: `HR ${decision} leave for ${staff.full_name}`,
      meta: { notes, requestedDays: leave.requested_days },
    });
    await enqueueLeaveDecision(admin, {
      propertyId,
      staffId: leave.staff_id as string,
      leaveId,
      decision,
      email: staff.email,
    });
    await processStaffNotificationOutbox();

    refreshLeave();
    return { ok: true, message: `Leave ${decision}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not review leave.",
    };
  }
}

export async function refreshLeaveAccruals(
  previous: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  void previous;
  void formData;
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const today = new Date().toISOString().slice(0, 10);
    const { data: staff } = await admin
      .from("staff_members")
      .select("id, hired_on, probation_ends_on")
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"]);
    let attempted = 0;
    for (const member of staff ?? []) {
      attempted += await syncStaffAccruals(
        admin,
        propertyId,
        {
          id: member.id as string,
          hired_on: (member.hired_on as string | null) ?? null,
          probation_ends_on: (member.probation_ends_on as string | null) ?? null,
        },
        today,
      );
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "leave.accrual_refresh",
      entityType: "hr_leave_ledger",
      summary: `Refreshed leave accruals for ${(staff ?? []).length} staff`,
      meta: { attempted },
    });
    refreshLeave();
    return { ok: true, message: `Balances refreshed for ${(staff ?? []).length} staff.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not refresh balances.",
    };
  }
}

export async function createLeavePolicyVersion(
  _previous: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const policyId = String(formData.get("policy_id") ?? "").trim();
    const effectiveFrom = isoDate(formData.get("effective_from"), "Effective date");
    const numberValue = (name: string, label: string, min: number, max: number) => {
      const value = Number(formData.get(name));
      if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${label} must be between ${min} and ${max}.`);
      }
      return value;
    };

    const { data: existing } = await admin
      .from("hr_leave_policies")
      .select("*")
      .eq("id", policyId)
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!existing) throw new Error("Leave policy not found.");
    if (effectiveFrom <= (existing.effective_from as string)) {
      throw new Error("New version must start after the current version.");
    }

    const endDate = addDays(effectiveFrom, -1);
    const previousEffectiveTo = (existing.effective_to as string | null) ?? null;
    const { error: closeError } = await admin
      .from("hr_leave_policies")
      .update({ effective_to: endDate, updated_at: new Date().toISOString() })
      .eq("id", policyId);
    if (closeError) throw new Error("Could not close the current policy version.");

    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...copy
    } = existing;
    void _id;
    void _createdAt;
    void _updatedAt;
    const { data: created, error } = await admin
      .from("hr_leave_policies")
      .insert({
        ...copy,
        effective_from: effectiveFrom,
        effective_to: null,
        accrual_days: numberValue("accrual_days", "Accrual days", 0, 365),
        notice_days: numberValue("notice_days", "Notice days", 0, 365),
        paid_rate: numberValue("paid_rate", "Paid rate", 0, 1),
        allow_half_day: formData.get("allow_half_day") === "on",
        encashable: formData.get("encashable") === "on",
        source_name: "Pelbu Suites policy version",
        source_url: null,
      })
      .select("id")
      .single();
    if (error || !created) {
      await admin
        .from("hr_leave_policies")
        .update({ effective_to: previousEffectiveTo })
        .eq("id", policyId);
      throw new Error("Could not create the new policy version.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "leave.policy_version",
      entityType: "hr_leave_policies",
      entityId: created.id as string,
      summary: `Created new ${existing.name as string} policy version`,
      meta: { previousPolicyId: policyId, effectiveFrom },
    });
    refreshLeave();
    return { ok: true, message: "New policy version created." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not version policy.",
    };
  }
}

export async function createLeaveBlackout(
  _previous: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const name = String(formData.get("name") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const startsOn = isoDate(formData.get("starts_on"), "Start date");
    const endsOn = isoDate(formData.get("ends_on"), "End date");
    if (name.length < 2 || !reason) throw new Error("Name and reason are required.");
    if (endsOn < startsOn) throw new Error("End date must be on or after start.");
    const policyId = String(formData.get("leave_policy_id") ?? "").trim() || null;
    const department = String(formData.get("department") ?? "").trim() || null;

    const { data, error } = await admin
      .from("hr_leave_blackouts")
      .insert({
        property_id: propertyId,
        name,
        reason,
        starts_on: startsOn,
        ends_on: endsOn,
        department,
        leave_policy_id: policyId,
        is_hard_block: formData.get("is_hard_block") === "on",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not create blackout period.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "leave.blackout_create",
      entityType: "hr_leave_blackouts",
      entityId: data.id as string,
      summary: `Created leave blackout: ${name}`,
      meta: { startsOn, endsOn, department, policyId },
    });
    refreshLeave();
    return { ok: true, message: "Blackout period created." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create blackout.",
    };
  }
}
