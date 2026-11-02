import { requireAgentPropertySession } from "@/lib/agent-auth";
import { buildWorkbook } from "@/lib/accounting/export";
import {
  agentStayDateBounds,
  loadAgentStayRows,
  stayOverlapsRange,
} from "@/lib/agent-portal-stays";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAgentPropertySession();
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from") ?? "";
    const toParam = url.searchParams.get("to") ?? "";
    const pendingOnly = url.searchParams.get("preset") === "pending";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    const admin = createSupabaseAdminClient();
    let rows = await loadAgentStayRows(admin, {
      agentId: session.agentId,
      propertyId: session.activePropertyId,
      sessionAgentId: session.agentId,
      limit: 500,
    });

    const bounds = agentStayDateBounds(rows);
    const from =
      /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : bounds.from ?? "";
    const to =
      /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : bounds.to ?? "";

    if (from && to) {
      rows = rows.filter((r) =>
        stayOverlapsRange(r.checkIn, r.checkOut, from, to),
      );
    }
    if (pendingOnly) {
      rows = rows.filter(
        (r) => r.paymentStatus === "unpaid" || r.paymentStatus === "partial",
      );
    }
    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.confirmationLabel,
          r.guestName,
          r.guideNumber,
          r.nationality,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const link = session.links.find(
      (l) => l.propertyId === session.activePropertyId,
    );
    const hotelName = link?.propertyName ?? "Hotel";

    const header = [
      "Sl.no",
      "Ref",
      "Guest Name",
      "Pax",
      "Nationality",
      "Guide no",
      "Check-in",
      "Checkout",
      "Nights",
      "Meal",
      "Rate",
      "Total",
      "GST",
      "S.C",
      "G.total",
      "Paid",
      "Due",
      "Payment Status",
    ];

    const body = rows.map((r, i) => [
      i + 1,
      r.confirmationLabel,
      r.guestName ?? "",
      r.paxCount,
      r.nationality ?? "",
      r.guideNumber ?? "",
      r.checkIn,
      r.checkOut,
      r.nights,
      r.mealPlanCode,
      Number(r.rateBtn.toFixed(2)),
      Number(r.subtotalBtn.toFixed(2)),
      Number(r.gstBtn.toFixed(2)),
      Number(r.serviceChargeBtn.toFixed(2)),
      Number(r.grandTotalBtn.toFixed(2)),
      Number(r.paidBtn.toFixed(2)),
      Number(r.dueBtn.toFixed(2)),
      r.paymentStatus,
    ]);

    const nights = rows.reduce(
      (s, r) => s + r.nights * Math.max(1, r.roomsCount),
      0,
    );
    const amount = rows.reduce((s, r) => s + r.grandTotalBtn, 0);
    const paid = rows.reduce((s, r) => s + r.paidBtn, 0);
    const dues = rows.reduce(
      (s, r) => s + (Math.abs(r.dueBtn) > 0.5 ? r.dueBtn : 0),
      0,
    );
    body.push([
      "Total",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      nights,
      "",
      "",
      "",
      "",
      "",
      Number(amount.toFixed(2)),
      Number(paid.toFixed(2)),
      Number(dues.toFixed(2)),
      "",
    ]);

    const buffer = await buildWorkbook({
      title: `${session.companyName} — B2B bookings ledger`,
      propertyName: hotelName,
      from: from || "—",
      to: to || "—",
      sheets: [{ name: "Bookings", header, rows: body }],
    });

    const slug = (session.companyName || "agent")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${slug}-bookings.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("agents stays export", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 401 },
    );
  }
}
