import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public health probe — no secrets; optional DB ping when configured (Coolify/DR). */
export async function GET() {
  const payload: {
    ok: boolean;
    ts: string;
    service: string;
    db?: "ok" | "error" | "skipped";
  } = {
    ok: true,
    ts: new Date().toISOString(),
    service: "innora-desk",
  };

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("properties")
        .select("id")
        .limit(1)
        .maybeSingle();
      payload.db = error ? "error" : "ok";
      if (error) payload.ok = false;
    } catch {
      payload.db = "error";
      payload.ok = false;
    }
  } else {
    payload.db = "skipped";
  }

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}
