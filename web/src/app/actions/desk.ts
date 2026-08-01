"use server";

import {
  DESK_COOKIE_NAME,
  deskCookieValue,
  deskPinConfigured,
  deskPinAllowedInProduction,
  verifyDeskPin,
} from "@/lib/desk-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type DeskLoginState = {
  ok: boolean;
  error?: string;
};

export async function deskLogin(
  _prev: DeskLoginState,
  formData: FormData,
): Promise<DeskLoginState> {
  if (
    process.env.NODE_ENV === "production" &&
    !deskPinAllowedInProduction()
  ) {
    return {
      ok: false,
      error: "Shared desk PIN is disabled in production. Sign in with staff Auth.",
    };
  }

  const h = await headers();
  const ip = clientIp(h);
  const rl = await rateLimit(`desk-login:${ip}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return { ok: false, error: "Too many login attempts. Try again later." };
  }

  const pin = String(formData.get("pin") ?? "");
  if (!deskPinConfigured()) {
    return {
      ok: false,
      error: "Set DESK_PIN in environment before using the desk in production.",
    };
  }
  if (!verifyDeskPin(pin)) {
    return { ok: false, error: "Incorrect desk PIN." };
  }

  const jar = await cookies();
  jar.set(DESK_COOKIE_NAME, deskCookieValue(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/erp");
}

export async function deskLogout(): Promise<void> {
  const jar = await cookies();
  jar.delete(DESK_COOKIE_NAME);

  // Dual-auth: desk-capable staff may be on /erp via Supabase Auth without a PIN cookie.
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore Auth sign-out failures; PIN cookie is already cleared.
  }

  redirect("/login");
}
