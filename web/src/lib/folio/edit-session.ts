import "server-only";

import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { isManagerDeskRole } from "@/lib/manager-pin-core";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const COOKIE = "hotelos_folio_edit";
const MAX_AGE_SEC = 4 * 60 * 60;

export type FolioEditSession = {
  propertyId: string;
  until: number;
  actor: string;
};

function parseSession(raw: string | undefined): FolioEditSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FolioEditSession;
    if (!parsed?.propertyId || !parsed.until || !parsed.actor) return null;
    if (parsed.until < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readFolioEditSession(
  propertyId: string,
): Promise<FolioEditSession | null> {
  const jar = await cookies();
  const session = parseSession(jar.get(COOKIE)?.value);
  if (!session || session.propertyId !== propertyId) return null;
  return session;
}

export async function startFolioEditSession(input: {
  admin: Admin;
  propertyId: string;
  pin?: string | null;
}): Promise<{ ok: true; actor: string } | { ok: false; error: string }> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Desk session expired." };
  }
  const role = await getDeskRole();
  const pin = (input.pin ?? "").trim();
  let actor = role ? `desk:${role}` : "desk";

  if (isManagerDeskRole(role) && !pin) {
    actor = `desk:${role}`;
  } else {
    const verified = await verifyManagerPinForProperty(
      input.admin,
      input.propertyId,
      pin,
    );
    if (!verified.ok) return { ok: false, error: verified.error };
    actor =
      verified.source === "staff"
        ? `staff:${verified.staffId}:${verified.fullName}`
        : "env_manager_pin";
  }

  const session: FolioEditSession = {
    propertyId: input.propertyId,
    until: Date.now() + MAX_AGE_SEC * 1000,
    actor,
  };
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return { ok: true, actor };
}

/** Use an open edit session, or start one from the PIN on this form. */
export async function ensureFolioEditSession(input: {
  admin: Admin;
  propertyId: string;
  pin?: string | null;
}): Promise<{ ok: true; actor: string } | { ok: false; error: string }> {
  const existing = await readFolioEditSession(input.propertyId);
  if (existing) return { ok: true, actor: existing.actor };
  return startFolioEditSession(input);
}
