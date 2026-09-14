import { isDeskAuthenticated } from "@/lib/desk-auth";
import { isKitchenBoardVisible } from "@/lib/kot-visibility";
import { loadOpenPosTickets } from "@/lib/pos";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight KDS board payload: open tickets + version fingerprint +
 * status counts. Called on SSE push (and rare safety poll) — not a tight timer.
 */
export async function GET() {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  await resolveActivePropertyId(admin);

  let tickets;
  try {
    tickets = await loadOpenPosTickets(admin);
  } catch (e) {
    console.error("kot-board load failed", e);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Settlement ≠ kitchen done — public room + paid online share the same rule.
  const boardVisible = tickets.filter((t) => isKitchenBoardVisible(t));

  const counts = {
    new: boardVisible.filter((t) => t.kot_status === "new").length,
    preparing: boardVisible.filter((t) => t.kot_status === "preparing").length,
    ready: boardVisible.filter((t) => t.kot_status === "ready").length,
  };

  // Fingerprint ticket id + status + parking so any kitchen-relevant change bumps.
  const version = createHash("sha256")
    .update(
      JSON.stringify(
        tickets.map((t) => ({
          id: t.id,
          kot: t.kot_status,
          park: t.is_parked,
          paid: t.payment_recorded_at,
          conf: t.confirmed_at,
          total: t.total_btn,
          items: t.order_items.map((i) => `${i.qty}x${i.name_snapshot}`).join("|"),
        })),
      ),
    )
    .digest("hex")
    .slice(0, 24);

  return NextResponse.json({
    version,
    counts,
    tickets,
    fetchedAt: new Date().toISOString(),
  });
}
