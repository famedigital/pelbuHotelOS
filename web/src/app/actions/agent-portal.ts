"use server";

import {
  assertPortalAgentScope,
  requireAgentPropertySession,
} from "@/lib/agent-auth";
import { writeAuditEvent } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AgentPortalState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function trimRequired(v: FormDataEntryValue | null, label: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

/** Partner uploads a payment screenshot / proof for their own stay. */
export async function uploadAgentPaymentProof(
  _prev: AgentPortalState,
  formData: FormData,
): Promise<AgentPortalState> {
  try {
    const session = await requireAgentPropertySession();
    const admin = createSupabaseAdminClient();
    const bookingId = trimRequired(formData.get("booking_id"), "Stay");
    const docUrl = trimRequired(formData.get("doc_url"), "File URL");
    const docName = String(formData.get("doc_name") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    try {
      const u = new URL(docUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new Error("bad");
      }
    } catch {
      throw new Error("Upload URL must be http(s).");
    }

    const { data: booking } = await admin
      .from("bookings")
      .select("id, property_id, agent_id, contact_name, confirmation_code")
      .eq("id", bookingId)
      .maybeSingle();

    if (
      !booking ||
      booking.agent_id !== session.agentId ||
      booking.property_id !== session.activePropertyId
    ) {
      throw new Error("Stay not found for your account.");
    }
    assertPortalAgentScope(session, booking.agent_id as string);

    const { error } = await admin.from("agent_booking_attachments").insert({
      property_id: session.activePropertyId,
      agent_id: session.agentId,
      booking_id: bookingId,
      kind: "payment_proof",
      doc_url: docUrl,
      doc_name: docName,
      notes,
      uploaded_by: "agent",
    });
    if (error) {
      console.error("uploadAgentPaymentProof", error);
      throw new Error(
        "Could not save proof. Ask the desk if attachments are not enabled yet.",
      );
    }

    await writeAuditEvent(admin, {
      propertyId: session.activePropertyId,
      action: "agent.payment_proof_uploaded",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Partner payment proof · ${session.companyName}`,
      meta: {
        agent_id: session.agentId,
        doc_name: docName,
      },
    });

    revalidatePath("/agents/app");
    revalidatePath("/agents/app/stays");
    revalidatePath(`/agents/app/stays/${bookingId}`);
    revalidatePath("/agents/app/money");
    return { ok: true, message: "Payment proof uploaded for the desk." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not upload proof.",
    };
  }
}
