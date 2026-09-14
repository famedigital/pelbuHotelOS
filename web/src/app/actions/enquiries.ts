"use server";

import { notifyNewEnquiry } from "@/lib/notify";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";

export type EnquiryState = {
  ok: boolean;
  enquiryId?: string;
  error?: string;
};

const TOPICS = new Set([
  "general",
  "rooms",
  "dining",
  "spa",
  "meeting",
  "agents",
  "other",
]);

export async function createEnquiry(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  try {
    const topic = trimRequired(formData.get("topic"), "Topic").toLowerCase();
    if (!TOPICS.has(topic)) {
      throw new Error("Choose a valid enquiry topic.");
    }

    const contactName = trimRequired(formData.get("contact_name"), "Full name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const message = trimRequired(formData.get("message"), "Message");
    if (message.length < 10) {
      throw new Error("Please write a bit more detail in your message.");
    }
    if (message.length > 2000) {
      throw new Error("Message is too long (max 2000 characters).");
    }

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", DEFAULT_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the desk.");
    }

    const { data: enquiry, error } = await admin
      .from("enquiries")
      .insert({
        property_id: property.id,
        topic,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        message,
        status: "new",
      })
      .select("id")
      .single();

    if (error || !enquiry) {
      console.error("createEnquiry insert failed", error);
      throw new Error("Could not send your message. Please try again.");
    }

    await notifyNewEnquiry({
      enquiryId: enquiry.id,
      topic,
      contactName,
      contactPhone,
      contactEmail,
      message,
    });

    return { ok: true, enquiryId: enquiry.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
