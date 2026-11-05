import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { netFolioBalance } from "@/lib/folio/balance";

export interface AgentOption {
  id: string;
  companyName: string;
  market?: string | null;
  status?: string | null;
}

export interface AgentDossierStay {
  id: string;
  bookingId: string;
  confirmationCode: string;
  roomLabel: string;
  guestName: string;
  pax: number;
  nationality?: string | null;
  guideName?: string | null;
  guidePhone?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  mealPlan: string;
  status: "confirmed" | "checked_in" | "checked_out" | "held" | "cancelled";
  grossAmountBtn: number;
  paidAmountBtn: number;
  dueAmountBtn: number;
  folioId?: string | null;
}

export interface AgentDossierData {
  agent: {
    id: string;
    companyName: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    creditLimitBtn: number;
    creditUsedBtn: number;
    commissionPct: number;
    status: string;
  };
  stats: {
    totalBookings: number;
    inHouseCount: number;
    upcomingCount: number;
    completedCount: number;
    totalNights: number;
    grossRevenueBtn: number;
    totalPaidBtn: number;
    outstandingDueBtn: number;
  };
  stays: AgentDossierStay[];
}

export async function listPropertyAgents(propertyId: string): Promise<AgentOption[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("agents")
    .select("id, company_name, market, status")
    .order("company_name");

  if (error || !data) {
    console.error("[listPropertyAgents] error", error);
    return [];
  }

  return data.map((a) => ({
    id: a.id,
    companyName: a.company_name,
    market: a.market,
    status: a.status,
  }));
}

export async function loadAgentDossier(
  propertyId: string,
  agentId: string
): Promise<AgentDossierData | null> {
  const admin = createSupabaseAdminClient();

  // 1. Fetch Agent Profile
  const { data: agentRow, error: agentError } = await admin
    .from("agents")
    .select("id, company_name, contact_name, contact_email, contact_phone, credit_limit, credit_used, commission_pct, status")
    .eq("id", agentId)
    .single();

  if (agentError || !agentRow) {
    console.error("[loadAgentDossier] Agent not found", agentError);
    return null;
  }

  // 2. Fetch all bookings for this agent at this property
  const { data: bookingRows, error: bookingError } = await admin
    .from("bookings")
    .select(`
      id,
      contact_name,
      contact_phone,
      check_in,
      check_out,
      status,
      quoted_total_btn,
      guide_number,
      room_assignments (
        room_units (
          label
        )
      ),
      folios (
        id,
        folio_lines (
          id,
          source_type,
          total_btn,
          status
        )
      )
    `)
    .eq("property_id", propertyId)
    .eq("agent_id", agentId)
    .order("check_in", { ascending: false });

  if (bookingError) {
    console.error("[loadAgentDossier] Bookings fetch error", bookingError);
  }

  const stays: AgentDossierStay[] = [];
  let inHouseCount = 0;
  let upcomingCount = 0;
  let completedCount = 0;
  let totalNights = 0;
  let grossRevenueBtn = 0;
  let totalPaidBtn = 0;
  let outstandingDueBtn = 0;

  const today = new Date().toISOString().slice(0, 10);

  for (const b of bookingRows ?? []) {
    // Calculate nights
    const start = new Date(b.check_in).getTime();
    const end = new Date(b.check_out).getTime();
    const nights = Math.max(1, Math.round((end - start) / 86400000));
    totalNights += nights;

    // Room Label & Meal
    const firstAssignment = (b.room_assignments as Array<{ room_units: { label?: string } | null }>)?.[0];
    const roomLabel = firstAssignment?.room_units?.label
      ? `Room ${firstAssignment.room_units.label}`
      : "Assigned";
    const mealPlan = "EP";

    // Folio and payments
    const folio = b.folios?.[0];
    let dueBtn = 0;
    let paidBtn = 0;
    let grossBtn = Number(b.quoted_total_btn ?? 0);

    if (folio && folio.folio_lines) {
      const lines = folio.folio_lines as Array<{
        id: string;
        source_type: string;
        total_btn: number;
        status: string;
      }>;
      const validLines = lines.filter((l) => l.status !== "voided");

      const debits = validLines
        .filter((l) => l.source_type !== "payment")
        .reduce((sum, l) => sum + Number(l.total_btn || 0), 0);
      const credits = validLines
        .filter((l) => l.source_type === "payment")
        .reduce((sum, l) => sum + Number(l.total_btn || 0), 0);

      if (debits > 0) grossBtn = debits;
      paidBtn = credits;
      dueBtn = Math.max(0, grossBtn - paidBtn);
    } else {
      dueBtn = grossBtn;
    }

    grossRevenueBtn += grossBtn;
    totalPaidBtn += paidBtn;
    outstandingDueBtn += dueBtn;

    // Status counts
    if (b.status === "checked_in") {
      inHouseCount++;
    } else if (b.check_in > today) {
      upcomingCount++;
    } else if (b.status === "checked_out") {
      completedCount++;
    }

    stays.push({
      id: b.id,
      bookingId: b.id,
      confirmationCode: `PS-${b.id.slice(0, 6).toUpperCase()}`,
      roomLabel,
      guestName: b.contact_name?.trim() || "Guest",
      pax: 2, // Default standard pax
      guideName: b.guide_number ? `Guide #${b.guide_number}` : null,
      guidePhone: b.contact_phone || null,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights,
      mealPlan,
      status: (b.status as AgentDossierStay["status"]) || "confirmed",
      grossAmountBtn: grossBtn,
      paidAmountBtn: paidBtn,
      dueAmountBtn: dueBtn,
      folioId: folio?.id || null,
    });
  }

  return {
    agent: {
      id: agentRow.id,
      companyName: agentRow.company_name,
      contactPerson: agentRow.contact_name,
      email: agentRow.contact_email,
      phone: agentRow.contact_phone,
      creditLimitBtn: Number(agentRow.credit_limit ?? 500000),
      creditUsedBtn: Number(agentRow.credit_used ?? outstandingDueBtn),
      commissionPct: Number(agentRow.commission_pct ?? 10),
      status: agentRow.status ?? "active",
    },
    stats: {
      totalBookings: stays.length,
      inHouseCount,
      upcomingCount,
      completedCount,
      totalNights,
      grossRevenueBtn,
      totalPaidBtn,
      outstandingDueBtn,
    },
    stays,
  };
}
