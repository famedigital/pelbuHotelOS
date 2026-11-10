"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PartyDocKind = "sdf_pack" | "voucher" | "reg" | "other";

export type PartyDocument = {
  id: string;
  groupId: string;
  kind: PartyDocKind;
  title: string | null;
  storagePublicId: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
};

export async function listPartyDocuments(
  groupId: string,
): Promise<
  { ok: true; data: PartyDocument[] } | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const gid = groupId.trim();
    if (!gid) return { ok: false, error: "Group required." };

    const { data, error } = await admin
      .from("booking_group_documents")
      .select(
        "id, group_id, kind, title, storage_public_id, file_url, notes, created_at",
      )
      .eq("group_id", gid)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id as string,
        groupId: r.group_id as string,
        kind: r.kind as PartyDocKind,
        title: (r.title as string | null) ?? null,
        storagePublicId: (r.storage_public_id as string | null) ?? null,
        fileUrl: (r.file_url as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        createdAt: r.created_at as string,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load documents.",
    };
  }
}

export async function savePartyDocument(input: {
  groupId: string;
  kind: PartyDocKind;
  title?: string | null;
  storagePublicId: string;
  notes?: string | null;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const gid = input.groupId.trim();
    const publicId = input.storagePublicId.trim();
    if (!gid || !publicId) {
      return { ok: false, error: "Group and file required." };
    }

    const { data: group } = await admin
      .from("booking_groups")
      .select("id")
      .eq("id", gid)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!group) return { ok: false, error: "Group not found." };

    const kind = input.kind;
    const title =
      input.title?.trim() ||
      (kind === "sdf_pack"
        ? "SDF pack"
        : kind === "voucher"
          ? "Voucher"
          : kind === "reg"
            ? "Registration"
            : "Document");

    const { error } = await admin.from("booking_group_documents").insert({
      group_id: gid,
      property_id: propertyId,
      kind,
      title,
      storage_public_id: publicId,
      notes: input.notes?.trim() || null,
    });
    if (error) throw new Error(error.message);

    if (kind === "sdf_pack") {
      await admin
        .from("booking_groups")
        .update({ docs_deferred: false })
        .eq("id", gid);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "reservations.party.doc_upload",
      entityType: "booking_groups",
      entityId: gid,
      summary: `Uploaded ${kind} · ${title}`,
      meta: { publicId },
    });

    revalidatePath("/erp/reservations");
    revalidatePath("/erp/calendar");
    return { ok: true, message: `${title} saved to party vault.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save document.",
    };
  }
}

export async function deletePartyDocument(
  documentId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = documentId.trim();
    if (!id) return { ok: false, error: "Document required." };

    const { error } = await admin
      .from("booking_group_documents")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/reservations");
    return { ok: true, message: "Document removed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not delete.",
    };
  }
}
