"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export type PlatformLoginState = { ok: boolean; error?: string };

function emailAllowlisted(email: string): boolean {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  const set = new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(email.toLowerCase());
}

export async function platformAdminLogin(
  _prev: PlatformLoginState,
  formData: FormData,
): Promise<PlatformLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email and password required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Invalid email or password." };

  const { data } = await supabase.auth.getUser();
  const userEmail = data.user?.email?.toLowerCase();
  if (!userEmail) {
    await supabase.auth.signOut();
    return { ok: false, error: "No session." };
  }

  let allowed = emailAllowlisted(userEmail);
  if (!allowed) {
    try {
      const admin = createSupabaseAdminClient();
      const { data: row } = await admin
        .from("platform_admins")
        .select("id")
        .ilike("email", userEmail)
        .maybeSingle();
      allowed = Boolean(row);
    } catch {
      allowed = false;
    }
  }

  if (!allowed) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "This account is not a platform admin.",
    };
  }

  redirect("/admin");
}

export async function partnerLogin(
  _prev: PlatformLoginState,
  formData: FormData,
): Promise<PlatformLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email and password required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Invalid email or password." };

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    await supabase.auth.signOut();
    return { ok: false, error: "No session." };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: byUser } = await admin
      .from("distributor_members")
      .select("id, distributors(status)")
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle();

    let member = byUser;
    if (!member) {
      const { data: byEmail } = await admin
        .from("distributor_members")
        .select("id, distributors(status)")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      member = byEmail;
    }

    const dist = member?.distributors as unknown as { status?: string } | null;
    if (!member || dist?.status === "suspended") {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: "Not a distributor member, or distributor is suspended.",
      };
    }
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "Could not verify distributor membership (apply migrations).",
    };
  }

  redirect("/partner");
}

export async function platformLogout(next: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(next);
}
