"use server";

import { writeAuditEvent } from "@/lib/audit";
import { getCatalog } from "@/lib/dot-assessment/catalog";
import { computeScoreboard } from "@/lib/dot-assessment/score";
import type {
  AssessmentStatus,
  DotAssessmentRow,
  DotEvidence,
  DotResponse,
  PropertyInfo,
  ResponseStatus,
  StarLevel,
} from "@/lib/dot-assessment/types";
import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import {
  assertPropertyScopedPath,
  createFinanceSignedPreview,
} from "@/lib/finance-import/storage";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type State = { ok: boolean; message?: string; error?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function requireWriteAccess() {
  await requireDeskRole(["owner", "gm", "front_desk"]);
}

function mapAssessment(row: Record<string, unknown>): DotAssessmentRow {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    starLevel: row.star_level as StarLevel,
    status: row.status as AssessmentStatus,
    propertyInfo: (row.property_info as PropertyInfo) ?? {},
    leadAssessor: (row.lead_assessor as string | null) ?? null,
    assessor2: (row.assessor_2 as string | null) ?? null,
    assessor3: (row.assessor_3 as string | null) ?? null,
    assessedOn: (row.assessed_on as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    naSections: (row.na_sections as string[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapResponse(row: Record<string, unknown>): DotResponse {
  return {
    criterionCode: row.criterion_code as string,
    sectionKey: row.section_key as string,
    status: row.status as ResponseStatus,
    scoreM: row.score_m as number | null,
    scoreQ: row.score_q as number | null,
    scoreP: row.score_p != null ? Number(row.score_p) : null,
    remarks: (row.remarks as string | null) ?? null,
    updatedAt: row.updated_at as string | undefined,
  };
}

function mapEvidence(row: Record<string, unknown>): DotEvidence {
  return {
    id: row.id as string,
    criterionCode: row.criterion_code as string,
    storagePath: row.storage_path as string,
    fileName: row.file_name as string,
    mimeType: (row.mime_type as string | null) ?? null,
    byteSize: row.byte_size != null ? Number(row.byte_size) : null,
    caption: (row.caption as string | null) ?? null,
    uploadedAt: row.uploaded_at as string,
  };
}

async function loadOwnedAssessment(admin: ReturnType<typeof createSupabaseAdminClient>, id: string) {
  const propertyId = await resolveActivePropertyId(admin);
  const { data, error } = await admin
    .from("dot_assessments")
    .select("*")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Assessment not found.");
  return { propertyId, row: mapAssessment(data as Record<string, unknown>) };
}

export async function listDotAssessments(): Promise<DotAssessmentRow[]> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data, error } = await admin
    .from("dot_assessments")
    .select("*")
    .eq("property_id", propertyId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapAssessment(r as Record<string, unknown>));
}

export async function getDotAssessmentBundle(assessmentId: string): Promise<{
  assessment: DotAssessmentRow;
  responses: DotResponse[];
  evidence: DotEvidence[];
}> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const { row } = await loadOwnedAssessment(admin, assessmentId);

  const [{ data: resp }, { data: evid }] = await Promise.all([
    admin
      .from("dot_assessment_responses")
      .select("*")
      .eq("assessment_id", assessmentId),
    admin
      .from("dot_assessment_evidence")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("uploaded_at", { ascending: false }),
  ]);

  return {
    assessment: row,
    responses: (resp ?? []).map((r) => mapResponse(r as Record<string, unknown>)),
    evidence: (evid ?? []).map((r) => mapEvidence(r as Record<string, unknown>)),
  };
}

export async function createDotAssessment(formData: FormData): Promise<void> {
  await requireWriteAccess();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const starRaw = Number(formData.get("star_level"));
  if (starRaw !== 3 && starRaw !== 4) {
    throw new Error("Choose 3-star or 4-star checklist.");
  }
  const catalog = getCatalog(starRaw as StarLevel);

  const { data, error } = await admin
    .from("dot_assessments")
    .insert({
      property_id: propertyId,
      star_level: starRaw,
      status: "draft",
      catalog_version: catalog.version,
      catalog_source: catalog.sourceFile,
      property_info: {},
      na_sections: [],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditEvent(admin, {
    propertyId,
    entityType: "dot_assessments",
    entityId: data.id as string,
    action: "dot_assessment.create",
    summary: `Started ${starRaw}-star DOT assessment prep`,
  });

  revalidatePath("/erp/dot-assessment");
  redirect(`/erp/dot-assessment/${data.id}?step=guide`);
}

export async function updateDotAssessmentMeta(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireWriteAccess();
    const admin = createSupabaseAdminClient();
    const id = trimRequired(formData.get("assessment_id"), "Assessment");
    const { propertyId, row } = await loadOwnedAssessment(admin, id);

    const propertyInfo: PropertyInfo = { ...row.propertyInfo };
    const catalog = getCatalog(row.starLevel);
    for (const field of catalog.propertyFields) {
      const v = formData.get(`prop_${field.key}`);
      if (typeof v === "string") propertyInfo[field.key] = v.trim();
    }

    const naRaw = formData.getAll("na_section").map(String);
    const allowedNa = new Set(
      catalog.sections
        .filter((s) => s.key === "recreation" || s.key === "mice")
        .map((s) => s.key),
    );
    const naSections = naRaw.filter((k) => allowedNa.has(k));

    const patch = {
      property_info: propertyInfo,
      lead_assessor: optionalTrim(formData.get("lead_assessor")),
      assessor_2: optionalTrim(formData.get("assessor_2")),
      assessor_3: optionalTrim(formData.get("assessor_3")),
      assessed_on: optionalTrim(formData.get("assessed_on")),
      notes: optionalTrim(formData.get("notes")),
      na_sections: naSections,
      status: row.status === "draft" ? "in_progress" : row.status,
      updated_at: new Date().toISOString(),
    };

    // If status field provided
    const status = optionalTrim(formData.get("status")) as AssessmentStatus | null;
    if (status && ["draft", "in_progress", "ready", "archived"].includes(status)) {
      if (status === "ready") {
        const { responses } = await getDotAssessmentBundle(id);
        const board = computeScoreboard(catalog, responses, naSections);
        if (!board.readyForInspection) {
          return {
            ok: false,
            error:
              "Cannot mark Ready: complete all entry-gate items (Yes), fix failed M items, and answer all scorable criteria.",
          };
        }
      }
      (patch as { status: AssessmentStatus }).status = status;
    }

    const { error } = await admin
      .from("dot_assessments")
      .update(patch)
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath(`/erp/dot-assessment/${id}`);
    revalidatePath("/erp/dot-assessment");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export type DotResponseSaveResult = State & { response?: DotResponse };
export type DotEvidenceSaveResult = State & { evidence?: DotEvidence };

type ResponsePayload = {
  assessmentId: string;
  criterionCode: string;
  sectionKey?: string | null;
  status?: string | null;
  scoreM?: number | null;
  scoreQ?: number | null;
  scoreP?: number | null;
  remarks?: string | null;
};

function parseResponseFields(
  catalog: ReturnType<typeof getCatalog>,
  criterionCode: string,
  input: {
    sectionKey?: string | null;
    statusRaw?: string | null;
    scoreM?: number | null;
    scoreQ?: number | null;
    scoreP?: number | null;
    remarks?: string | null;
  },
): {
  sectionKey: string;
  status: ResponseStatus;
  scoreM: number | null;
  scoreQ: number | null;
  scoreP: number | null;
  remarks: string | null;
} {
  let sectionKey = input.sectionKey?.trim() || "";
  let kind = "M";
  let maxP: number | null = null;

  if (criterionCode.startsWith("gate.")) {
    sectionKey = "gate";
    if (!catalog.entryGate.some((x) => x.code === criterionCode)) {
      throw new Error("Unknown entry-gate item.");
    }
  } else {
    const found = catalog.sections
      .flatMap((s) => s.criteria.map((c) => ({ s, c })))
      .find((x) => x.c.code === criterionCode);
    if (!found) throw new Error("Unknown criterion.");
    sectionKey = found.s.key;
    kind = found.c.kind;
    maxP = found.c.maxPoints;
    if (kind === "X") {
      throw new Error("This criterion is N/A for this star level.");
    }
  }

  const statusRaw = input.statusRaw ?? "pending";
  let status: ResponseStatus = "pending";
  let scoreM: number | null = null;
  let scoreQ: number | null = null;
  let scoreP: number | null = null;

  if (statusRaw === "na") {
    status = "na";
  } else if (statusRaw === "yes") {
    status = "yes";
    scoreM = 1;
  } else if (statusRaw === "no") {
    status = "no";
    scoreM = 0;
  } else if (statusRaw === "pending") {
    status = "pending";
    scoreM = null;
    scoreQ = null;
    scoreP = null;
  } else if (statusRaw === "scored" || kind === "Q" || kind === "P" || kind === "custom") {
    if (input.scoreQ != null && Number.isFinite(input.scoreQ)) {
      if (input.scoreQ < 1 || input.scoreQ > 5) {
        throw new Error("Quality score must be 1–5.");
      }
      scoreQ = input.scoreQ;
      status = "scored";
    }
    if (input.scoreP != null && Number.isFinite(input.scoreP)) {
      if (input.scoreP < 0) throw new Error("Invalid P points.");
      if (maxP != null && input.scoreP > maxP) {
        throw new Error(`P points cannot exceed ${maxP}.`);
      }
      scoreP = input.scoreP;
      status = "scored";
    }
    if (input.scoreM === 0 || input.scoreM === 1) {
      scoreM = input.scoreM;
      status = input.scoreM === 1 ? "yes" : "no";
    }
  }

  if (input.scoreQ != null && Number.isFinite(input.scoreQ) && input.scoreQ >= 1 && input.scoreQ <= 5) {
    scoreQ = input.scoreQ;
    if (status === "pending") status = "scored";
  }
  if (input.scoreP != null && Number.isFinite(input.scoreP) && input.scoreP >= 0) {
    if (maxP != null && input.scoreP > maxP) {
      throw new Error(`P points cannot exceed ${maxP}.`);
    }
    scoreP = input.scoreP;
    if (status === "pending") status = "scored";
  }

  return {
    sectionKey,
    status,
    scoreM,
    scoreQ,
    scoreP,
    remarks: input.remarks?.trim() || null,
  };
}

/** Fast path for client UI — no revalidatePath (parent holds optimistic state). */
export async function saveDotResponse(
  payload: ResponsePayload,
): Promise<DotResponseSaveResult> {
  try {
    await requireWriteAccess();
    const admin = createSupabaseAdminClient();
    const { propertyId, row } = await loadOwnedAssessment(
      admin,
      payload.assessmentId,
    );
    const catalog = getCatalog(row.starLevel);
    const parsed = parseResponseFields(catalog, payload.criterionCode, {
      sectionKey: payload.sectionKey,
      statusRaw: payload.status,
      scoreM: payload.scoreM,
      scoreQ: payload.scoreQ,
      scoreP: payload.scoreP,
      remarks: payload.remarks,
    });
    const updatedAt = new Date().toISOString();

    const { error } = await admin.from("dot_assessment_responses").upsert(
      {
        assessment_id: payload.assessmentId,
        criterion_code: payload.criterionCode,
        section_key: parsed.sectionKey,
        status: parsed.status,
        score_m: parsed.scoreM,
        score_q: parsed.scoreQ,
        score_p: parsed.scoreP,
        remarks: parsed.remarks,
        updated_at: updatedAt,
      },
      { onConflict: "assessment_id,criterion_code" },
    );
    if (error) throw new Error(error.message);

    // Touch assessment without forcing client RSC re-render
    await admin
      .from("dot_assessments")
      .update({
        status: row.status === "ready" ? "ready" : "in_progress",
        updated_at: updatedAt,
      })
      .eq("id", payload.assessmentId)
      .eq("property_id", propertyId);

    return {
      ok: true,
      message: "Saved.",
      response: {
        criterionCode: payload.criterionCode,
        sectionKey: parsed.sectionKey,
        status: parsed.status,
        scoreM: parsed.scoreM,
        scoreQ: parsed.scoreQ,
        scoreP: parsed.scoreP,
        remarks: parsed.remarks,
        updatedAt,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertDotResponse(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const scoreMRaw = formData.get("score_m");
  const scoreQRaw = formData.get("score_q");
  const scorePRaw = formData.get("score_p");
  const result = await saveDotResponse({
    assessmentId: String(formData.get("assessment_id") ?? ""),
    criterionCode: String(formData.get("criterion_code") ?? ""),
    sectionKey: optionalTrim(formData.get("section_key")),
    status: optionalTrim(formData.get("status")),
    scoreM:
      scoreMRaw != null && String(scoreMRaw).trim() !== ""
        ? Number(scoreMRaw)
        : null,
    scoreQ:
      scoreQRaw != null && String(scoreQRaw).trim() !== ""
        ? Number(scoreQRaw)
        : null,
    scoreP:
      scorePRaw != null && String(scorePRaw).trim() !== ""
        ? Number(scorePRaw)
        : null,
    remarks: optionalTrim(formData.get("remarks")),
  });
  if (result.ok) {
    const id = String(formData.get("assessment_id") ?? "");
    // Soft revalidate for form-action callers only
    revalidatePath(`/erp/dot-assessment/${id}`);
  }
  return { ok: result.ok, message: result.message, error: result.error };
}

export async function saveDotEvidence(payload: {
  assessmentId: string;
  criterionCode: string;
  storagePath: string;
  fileName?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  caption?: string | null;
}): Promise<DotEvidenceSaveResult> {
  try {
    await requireWriteAccess();
    const admin = createSupabaseAdminClient();
    const { propertyId } = await loadOwnedAssessment(admin, payload.assessmentId);
    assertPropertyScopedPath(propertyId, payload.storagePath);

    const { data, error } = await admin
      .from("dot_assessment_evidence")
      .insert({
        assessment_id: payload.assessmentId,
        criterion_code: payload.criterionCode,
        storage_path: payload.storagePath,
        file_name:
          payload.fileName?.trim() ||
          payload.storagePath.split("/").pop() ||
          "evidence",
        mime_type: payload.mimeType?.trim() || null,
        byte_size: payload.byteSize ?? null,
        caption: payload.caption?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return {
      ok: true,
      message: "Evidence uploaded.",
      evidence: mapEvidence(data as Record<string, unknown>),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function registerDotEvidence(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const result = await saveDotEvidence({
    assessmentId: String(formData.get("assessment_id") ?? ""),
    criterionCode: String(formData.get("criterion_code") ?? ""),
    storagePath: String(formData.get("storage_path") ?? ""),
    fileName: optionalTrim(formData.get("file_name")),
    mimeType: optionalTrim(formData.get("mime_type")),
    byteSize: Number(formData.get("byte_size") ?? 0) || null,
    caption: optionalTrim(formData.get("caption")),
  });
  if (result.ok) {
    revalidatePath(
      `/erp/dot-assessment/${String(formData.get("assessment_id") ?? "")}`,
    );
  }
  return { ok: result.ok, message: result.message, error: result.error };
}

export async function removeDotEvidence(payload: {
  assessmentId: string;
  evidenceId: string;
}): Promise<State> {
  try {
    await requireWriteAccess();
    const admin = createSupabaseAdminClient();
    const { propertyId } = await loadOwnedAssessment(admin, payload.assessmentId);
    void propertyId;
    const { error } = await admin
      .from("dot_assessment_evidence")
      .delete()
      .eq("id", payload.evidenceId)
      .eq("assessment_id", payload.assessmentId);
    if (error) throw new Error(error.message);
    return { ok: true, message: "Evidence removed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteDotEvidence(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const result = await removeDotEvidence({
    assessmentId: String(formData.get("assessment_id") ?? ""),
    evidenceId: String(formData.get("evidence_id") ?? ""),
  });
  if (result.ok) {
    revalidatePath(
      `/erp/dot-assessment/${String(formData.get("assessment_id") ?? "")}`,
    );
  }
  return result;
}

export async function getDotEvidencePreviewUrl(
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    assertPropertyScopedPath(propertyId, storagePath);
    const url = await createFinanceSignedPreview(admin, storagePath);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function archiveDotAssessment(formData: FormData): Promise<State> {
  try {
    await requireWriteAccess();
    const admin = createSupabaseAdminClient();
    const id = trimRequired(formData.get("assessment_id"), "Assessment");
    const { propertyId } = await loadOwnedAssessment(admin, id);
    const { error } = await admin
      .from("dot_assessments")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/dot-assessment");
    revalidatePath(`/erp/dot-assessment/${id}`);
    return { ok: true, message: "Archived." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
