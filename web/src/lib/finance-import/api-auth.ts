import "server-only";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export function financeWorkerSecretOk(header: string | null): boolean {
  const expected = process.env.FINANCE_WORKER_SECRET?.trim();
  if (!expected) return false;
  return Boolean(header && header === expected);
}

export function geminiIntegrationStatus(): {
  configured: boolean;
  provider: "gemini";
  model: string;
} {
  return {
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    provider: "gemini",
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
  };
}

export async function requireDeskFinanceApi() {
  if (!(await isDeskAuthenticated())) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      admin: null as never,
      propertyId: null as never,
    };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  return { error: null, admin, propertyId };
}

export function requireWorkerAuth(request: Request) {
  const secret = request.headers.get("x-finance-worker-secret");
  if (!financeWorkerSecretOk(secret)) {
    return {
      error: NextResponse.json({ error: "Unauthorized worker" }, { status: 401 }),
    };
  }
  return { error: null, admin: createSupabaseAdminClient() };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
