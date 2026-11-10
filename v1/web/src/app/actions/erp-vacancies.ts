"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type VacancyActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  positionId?: string;
  vacancyId?: string;
  applicationId?: string;
};

const EMPLOYMENT_TYPES = new Set([
  "full_time",
  "part_time",
  "casual",
  "contract",
  "intern",
]);

const VACANCY_STATUSES = new Set(["draft", "open", "filled", "closed"]);
const APP_STATUSES = new Set([
  "new",
  "reviewed",
  "shortlisted",
  "rejected",
  "hired",
]);
const TEMPLATE_KINDS = new Set([
  "tor",
  "job_desc",
  "application_form",
  "offer_letter",
  "contract",
  "checklist",
  "other",
]);

async function requireHrDesk(): Promise<{ admin: Admin; propertyId: string }> {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  const admin = createSupabaseAdminClient();
  return { admin, propertyId: await resolveActivePropertyId(admin) };
}

function refreshVacancies(extra?: string): void {
  revalidatePath("/erp/hr");
  revalidatePath("/erp/hr/positions");
  revalidatePath("/erp/hr/vacancies");
  revalidatePath("/erp");
  revalidatePath("/careers");
  if (extra) revalidatePath(extra);
}

function parseMoney(
  value: FormDataEntryValue | null,
  label: string,
): number | null {
  const raw = optionalTrim(value);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.round(n * 100) / 100;
}

function parseHeadcount(value: FormDataEntryValue | null): number {
  const raw = optionalTrim(value) ?? "1";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) {
    throw new Error("Headcount must be between 1 and 99.");
  }
  return n;
}

// ── Positions ──────────────────────────────────────────────────────────────

export async function upsertJobPosition(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = optionalTrim(formData.get("id"));
    const title = trimRequired(formData.get("title"), "Title");
    const department = trimRequired(formData.get("department"), "Department");
    const employmentType = (
      optionalTrim(formData.get("employment_type_default")) ?? "full_time"
    ).toLowerCase();
    if (!EMPLOYMENT_TYPES.has(employmentType)) {
      throw new Error("Invalid employment type.");
    }
    const torSummary = optionalTrim(formData.get("tor_summary"));
    const torBody = optionalTrim(formData.get("tor_body"));
    const publishTorPublic = formData.get("publish_tor_public") === "on";
    if (publishTorPublic && !torSummary && !torBody) {
      throw new Error(
        "Add a TOR summary or full TOR before publishing TOR to careers.",
      );
    }

    const record = {
      property_id: propertyId,
      title,
      department,
      employment_type_default: employmentType,
      tor_summary: torSummary,
      tor_body: torBody,
      publish_tor_public: publishTorPublic,
      // Create form omits checkbox → default active; edit uses checked = on.
      is_active: id
        ? formData.get("is_active") === "on"
        : formData.get("is_active") !== "off",
      updated_at: new Date().toISOString(),
    };

    let positionId = id;
    if (id) {
      const { error } = await admin
        .from("hr_job_positions")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) {
        if (error.code === "23505") {
          throw new Error("An active position with this title already exists in the department.");
        }
        throw new Error("Could not update position.");
      }
    } else {
      const { data, error } = await admin
        .from("hr_job_positions")
        .insert(record)
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23505") {
          throw new Error("An active position with this title already exists in the department.");
        }
        throw new Error("Could not create position.");
      }
      positionId = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "hr.position_update" : "hr.position_create",
      entityType: "hr_job_positions",
      entityId: positionId!,
      summary: `${id ? "Updated" : "Created"} position ${title}`,
      meta: { department, publishTorPublic },
    });

    refreshVacancies();
    return {
      ok: true,
      message: id ? "Position saved." : "Position created.",
      positionId: positionId ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save position.",
    };
  }
}

export async function upsertPositionTemplate(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const positionId = trimRequired(formData.get("position_id"), "Position");
    const kind = trimRequired(formData.get("template_kind"), "Template kind").toLowerCase();
    if (!TEMPLATE_KINDS.has(kind)) throw new Error("Invalid template kind.");

    const { data: position } = await admin
      .from("hr_job_positions")
      .select("id, title")
      .eq("id", positionId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!position) throw new Error("Position not found.");

    const publicId = trimRequired(
      formData.get("cloudinary_public_id"),
      "Uploaded file",
    );
    const defaultPrivate =
      kind === "offer_letter" || kind === "contract";
    const isPublic =
      formData.get("is_public") === "on" &&
      !defaultPrivate &&
      kind !== "offer_letter" &&
      kind !== "contract";

    const title =
      optionalTrim(formData.get("title")) ??
      (kind === "tor"
        ? "Terms of Reference"
        : kind === "application_form"
          ? "Application form"
          : kind === "offer_letter"
            ? "Offer letter template"
            : kind === "contract"
              ? "Contract template"
              : kind === "checklist"
                ? "Checklist"
                : kind === "job_desc"
                  ? "Job description"
                  : "Template");

    const record = {
      property_id: propertyId,
      position_id: positionId,
      template_kind: kind,
      title,
      cloudinary_public_id: publicId,
      resource_type: optionalTrim(formData.get("resource_type")) ?? "raw",
      file_url: optionalTrim(formData.get("file_url")),
      is_public: isPublic,
      sort_order: Number(optionalTrim(formData.get("sort_order")) ?? "0") || 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("hr_position_templates")
      .insert(record)
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not save template file.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "hr.position_template_upload",
      entityType: "hr_position_templates",
      entityId: data.id as string,
      summary: `Uploaded ${title} for ${position.title as string}`,
      meta: { kind, isPublic },
    });

    refreshVacancies();
    return {
      ok: true,
      message: "Template uploaded.",
      positionId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not upload template.",
    };
  }
}

export async function deletePositionTemplate(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("id"), "Template");
    const positionId = optionalTrim(formData.get("position_id"));
    const { error } = await admin
      .from("hr_position_templates")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not delete template.");
    refreshVacancies();
    return {
      ok: true,
      message: "Template removed.",
      positionId: positionId ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not delete template.",
    };
  }
}

// ── Vacancies ──────────────────────────────────────────────────────────────

export async function upsertJobVacancy(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = optionalTrim(formData.get("id"));
    const positionId = trimRequired(formData.get("position_id"), "Position");
    const status = (
      optionalTrim(formData.get("status")) ?? "draft"
    ).toLowerCase();
    if (!VACANCY_STATUSES.has(status)) throw new Error("Invalid status.");

    const { data: position } = await admin
      .from("hr_job_positions")
      .select("id, title, is_active")
      .eq("id", positionId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!position) throw new Error("Position not found.");
    if (!position.is_active && !id) {
      throw new Error("Cannot open a vacancy for an inactive position.");
    }

    let publishPublic = formData.get("publish_public") === "on";
    if (publishPublic && status !== "open") {
      throw new Error("Only open vacancies can be published on careers.");
    }

    const salaryMin = parseMoney(formData.get("salary_min_btn"), "Salary min");
    const salaryMax = parseMoney(formData.get("salary_max_btn"), "Salary max");
    if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
      throw new Error("Salary max must be greater than or equal to min.");
    }

    const record = {
      property_id: propertyId,
      position_id: positionId,
      headcount: parseHeadcount(formData.get("headcount")),
      status,
      publish_public: publishPublic,
      salary_min_btn: salaryMin,
      salary_max_btn: salaryMax,
      salary_note: optionalTrim(formData.get("salary_note")),
      show_salary_public: formData.get("show_salary_public") === "on",
      posting_note: optionalTrim(formData.get("posting_note")),
      opens_on: optionalTrim(formData.get("opens_on")),
      closes_on: optionalTrim(formData.get("closes_on")),
      updated_at: new Date().toISOString(),
    };

    let vacancyId = id;
    if (id) {
      const { error } = await admin
        .from("hr_job_vacancies")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not update vacancy.");
    } else {
      const { data, error } = await admin
        .from("hr_job_vacancies")
        .insert(record)
        .select("id")
        .single();
      if (error || !data) throw new Error("Could not create vacancy.");
      vacancyId = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "hr.vacancy_update" : "hr.vacancy_create",
      entityType: "hr_job_vacancies",
      entityId: vacancyId!,
      summary: `${id ? "Updated" : "Opened"} vacancy for ${position.title as string}`,
      meta: { status, publishPublic, headcount: record.headcount },
    });

    refreshVacancies();
    return {
      ok: true,
      message: id ? "Vacancy saved." : "Vacancy created.",
      vacancyId: vacancyId ?? undefined,
      positionId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save vacancy.",
    };
  }
}

export async function updateVacancyStatus(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("id"), "Vacancy");
    const status = trimRequired(formData.get("status"), "Status").toLowerCase();
    if (!VACANCY_STATUSES.has(status)) throw new Error("Invalid status.");

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status !== "open") {
      patch.publish_public = false;
    }

    const { error } = await admin
      .from("hr_job_vacancies")
      .update(patch)
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not update vacancy status.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "hr.vacancy_status",
      entityType: "hr_job_vacancies",
      entityId: id,
      summary: `Vacancy status → ${status}`,
      meta: { status },
    });

    refreshVacancies();
    return { ok: true, message: `Vacancy marked ${status}.`, vacancyId: id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not update status.",
    };
  }
}

export async function markApplicationStatus(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const { admin, propertyId } = await requireHrDesk();
    const id = trimRequired(formData.get("id"), "Application");
    const status = trimRequired(formData.get("status"), "Status").toLowerCase();
    if (!APP_STATUSES.has(status)) throw new Error("Invalid application status.");

    const { error } = await admin
      .from("hr_vacancy_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not update application.");

    refreshVacancies();
    return {
      ok: true,
      message: `Application marked ${status}.`,
      applicationId: id,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not update application.",
    };
  }
}

// ── Public careers interest ────────────────────────────────────────────────

export async function submitVacancyInterest(
  _previous: VacancyActionState,
  formData: FormData,
): Promise<VacancyActionState> {
  try {
    const honeypot = optionalTrim(formData.get("company_website"));
    if (honeypot) {
      return { ok: true, message: "Thanks — we’ll be in touch if there’s a fit." };
    }

    const vacancyId = trimRequired(formData.get("vacancy_id"), "Vacancy");
    const fullName = trimRequired(formData.get("full_name"), "Name");
    const phone = trimRequired(formData.get("phone"), "Phone");
    const email = optionalTrim(formData.get("email"));
    const message = optionalTrim(formData.get("message"));

    if (phone.replace(/\D/g, "").length < 7) {
      throw new Error("Enter a valid phone number.");
    }
    if (message && message.length > 2000) {
      throw new Error("Message is too long.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolvePublicPropertyId();
    if (!propertyId) throw new Error("Careers are temporarily unavailable.");

    const today = new Date().toISOString().slice(0, 10);
    const { data: vacancy } = await admin
      .from("hr_job_vacancies")
      .select("id, status, publish_public, closes_on, property_id")
      .eq("id", vacancyId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (
      !vacancy ||
      vacancy.status !== "open" ||
      !vacancy.publish_public
    ) {
      throw new Error("This opening is no longer accepting applications.");
    }
    if (vacancy.closes_on && (vacancy.closes_on as string) < today) {
      throw new Error("This opening has closed.");
    }

    // Simple rate pad: block more than 5 opens from same phone on same vacancy / day.
    const dayStart = `${today}T00:00:00.000Z`;
    const { count } = await admin
      .from("hr_vacancy_applications")
      .select("id", { count: "exact", head: true })
      .eq("vacancy_id", vacancyId)
      .eq("property_id", propertyId)
      .eq("phone", phone)
      .gte("created_at", dayStart);
    if ((count ?? 0) >= 3) {
      throw new Error("You have already applied for this role today.");
    }

    const { data, error } = await admin
      .from("hr_vacancy_applications")
      .insert({
        property_id: propertyId,
        vacancy_id: vacancyId,
        full_name: fullName,
        phone,
        email,
        message,
        status: "new",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not submit interest. Try again.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "hr.vacancy_interest",
      entityType: "hr_vacancy_applications",
      entityId: data.id as string,
      summary: `Career interest: ${fullName}`,
      meta: { vacancyId, phone },
    });

    revalidatePath("/erp/hr/vacancies");
    revalidatePath("/erp/hr");
    return {
      ok: true,
      message:
        "Thanks — we’ll call you on WhatsApp or phone if there’s a good fit.",
      applicationId: data.id as string,
      vacancyId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not submit interest.",
    };
  }
}
