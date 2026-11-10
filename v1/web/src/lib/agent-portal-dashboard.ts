import { assertPortalAgentScope } from "@/lib/agent-auth";
import {
  loadAgentStayRows,
  type AgentStayRow,
} from "@/lib/agent-portal-stays";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { thimphuToday } from "@/lib/erp-lists";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type AgentLivingJob = {
  id: string;
  kind: "hold" | "arrival" | "checkout" | "due" | "invoice" | "proof";
  rank: number;
  title: string;
  why: string;
  cta: string;
  href: string;
};

export type AgentLivingReport = {
  label: string;
  value: string;
  href: string;
  warn?: boolean;
};

export type AgentLivingCheck = {
  id: string;
  title: string;
  hint: string;
  href?: string;
};

export type AgentGuestRegRow = {
  id: string;
  bookingId: string;
  confirmationLabel: string;
  fullName: string;
  nationality: string | null;
  passportOrCid: string | null;
  sdfRef: string | null;
  checkIn: string;
  checkOut: string;
  stayStatus: string;
};

export type AgentInvoiceListRow = {
  id: string;
  docNo: string;
  docKind: string;
  status: string;
  issuedAt: string | null;
  totalBtn: number | null;
  bookingId: string | null;
  confirmationLabel: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
};

export type AgentPaymentListRow = {
  id: string;
  paidAt: string;
  amountBtn: number;
  method: string;
  reference: string | null;
  bookingId: string | null;
  confirmationLabel: string;
  guestName: string | null;
};

export type AgentLivingDashboard = {
  today: string;
  briefing: string;
  doJobs: AgentLivingJob[];
  reports: AgentLivingReport[];
  checks: AgentLivingCheck[];
  stays: AgentStayRow[];
  arrivalsToday: AgentStayRow[];
  arrivalsSoon: AgentStayRow[];
  inHouse: AgentStayRow[];
  checkoutsToday: AgentStayRow[];
  recentCheckouts: AgentStayRow[];
  openHolds: AgentStayRow[];
  guests: AgentGuestRegRow[];
  invoices: AgentInvoiceListRow[];
  payments: AgentPaymentListRow[];
  metrics: {
    arrivalsToday: number;
    checkoutsToday: number;
    inHouse: number;
    openHolds: number;
    openDueBtn: number;
    unpaidCheckouts: number;
    invoiceCount: number;
    paidBtn: number;
  };
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Living partner cockpit — own stays only. */
export async function loadAgentLivingDashboard(
  admin: Admin,
  opts: {
    agentId: string;
    propertyId: string;
    sessionAgentId: string;
  },
): Promise<AgentLivingDashboard> {
  assertPortalAgentScope({ agentId: opts.sessionAgentId }, opts.agentId);
  const today = thimphuToday();
  const soon = addDays(today, 7);

  const stays = await loadAgentStayRows(admin, {
    agentId: opts.agentId,
    propertyId: opts.propertyId,
    sessionAgentId: opts.sessionAgentId,
    limit: 200,
  });

  const arrivalsToday = stays.filter(
    (s) =>
      s.checkIn === today &&
      ["held", "pending", "confirmed", "checked_in"].includes(s.status),
  );
  const arrivalsSoon = stays.filter(
    (s) =>
      s.checkIn > today &&
      s.checkIn <= soon &&
      ["held", "pending", "confirmed"].includes(s.status),
  );
  const inHouse = stays.filter((s) => s.status === "checked_in");
  const checkoutsToday = stays.filter(
    (s) =>
      s.checkOut === today &&
      (s.status === "checked_in" ||
        s.status === "checked_out" ||
        s.status === "settled"),
  );
  const recentCheckouts = stays.filter(
    (s) =>
      (s.status === "checked_out" || s.status === "settled") &&
      s.checkOut >= addDays(today, -14),
  );
  const openHolds = stays.filter(
    (s) => s.status === "held" && Boolean(s.holdExpiresAt),
  );
  const unpaidCheckouts = checkoutsToday.filter(
    (s) => Math.abs(s.dueBtn) > 0.5,
  );

  const bookingIds = stays.map((s) => s.id);
  const stayById = new Map(stays.map((s) => [s.id, s]));

  let guests: AgentGuestRegRow[] = [];
  if (bookingIds.length) {
    const { data: guestRows, error: gErr } = await admin
      .from("booking_guests")
      .select(
        "id, booking_id, full_name, nationality, passport_or_cid, sdf_ref, sort_order",
      )
      .in("booking_id", bookingIds)
      .order("sort_order", { ascending: true })
      .limit(400);
    if (gErr) {
      console.warn("agent guests", gErr.message);
    } else {
      guests = (guestRows ?? []).map((g) => {
        const stay = stayById.get(g.booking_id as string);
        return {
          id: g.id as string,
          bookingId: g.booking_id as string,
          confirmationLabel: stay?.confirmationLabel ?? "—",
          fullName: (g.full_name as string) || "Guest",
          nationality: (g.nationality as string | null) ?? null,
          passportOrCid: (g.passport_or_cid as string | null) ?? null,
          sdfRef: (g.sdf_ref as string | null) ?? null,
          checkIn: stay?.checkIn ?? "—",
          checkOut: stay?.checkOut ?? "—",
          stayStatus: stay?.status ?? "—",
        };
      });
    }
  }

  const { data: fiscalRows } = await admin
    .from("fiscal_documents")
    .select(
      "id, doc_no, doc_kind, status, issued_at, total_btn, folio_id, folios(id, booking_id, agent_id, bookings(id, agent_id, confirmation_code, contact_name, check_in, check_out))",
    )
    .eq("property_id", opts.propertyId)
    .in("doc_kind", ["invoice", "receipt"])
    .order("issued_at", { ascending: false })
    .limit(150);

  const invoices: AgentInvoiceListRow[] = [];
  for (const d of fiscalRows ?? []) {
    const folioRaw = d.folios;
    const folio = Array.isArray(folioRaw) ? folioRaw[0] : folioRaw;
    const bookingRaw = folio?.bookings;
    const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;
    const agentId =
      (folio?.agent_id as string | null) ??
      (booking?.agent_id as string | null);
    if (agentId !== opts.agentId) continue;
    const bookingId =
      (folio?.booking_id as string | null) ??
      (booking?.id as string | null) ??
      null;
    invoices.push({
      id: d.id as string,
      docNo: d.doc_no as string,
      docKind: d.doc_kind as string,
      status: d.status as string,
      issuedAt: (d.issued_at as string | null) ?? null,
      totalBtn: d.total_btn == null ? null : Number(d.total_btn),
      bookingId,
      confirmationLabel: bookingConfirmationLabel({
        confirmationCode: booking?.confirmation_code as string | null,
        bookingId,
      }),
      guestName: (booking?.contact_name as string | null) ?? null,
      checkIn: (booking?.check_in as string | null) ?? null,
      checkOut: (booking?.check_out as string | null) ?? null,
    });
  }

  const { data: payRows } = await admin
    .from("payments")
    .select(
      "id, amount_btn, method, reference, created_at, status, booking_id, folio_id, bookings(id, agent_id, confirmation_code, contact_name), folios(id, agent_id, booking_id, bookings(id, agent_id, confirmation_code, contact_name))",
    )
    .eq("property_id", opts.propertyId)
    .order("created_at", { ascending: false })
    .limit(200);

  const payments: AgentPaymentListRow[] = [];
  for (const p of payRows ?? []) {
    if ((p.status as string | null) === "voided") continue;
    const bookingDirect = Array.isArray(p.bookings)
      ? p.bookings[0]
      : p.bookings;
    const folioRaw = p.folios;
    const folio = Array.isArray(folioRaw) ? folioRaw[0] : folioRaw;
    const bookingViaFolio = Array.isArray(folio?.bookings)
      ? folio?.bookings[0]
      : folio?.bookings;
    const booking = bookingDirect ?? bookingViaFolio;
    const agentId =
      (booking?.agent_id as string | null) ??
      (folio?.agent_id as string | null);
    if (agentId !== opts.agentId) continue;
    const bookingId =
      (p.booking_id as string | null) ??
      (folio?.booking_id as string | null) ??
      (booking?.id as string | null) ??
      null;
    payments.push({
      id: p.id as string,
      paidAt: (p.created_at as string).slice(0, 16).replace("T", " "),
      amountBtn: Number(p.amount_btn ?? 0),
      method: (p.method as string) ?? "—",
      reference: (p.reference as string | null) ?? null,
      bookingId,
      confirmationLabel: bookingConfirmationLabel({
        confirmationCode: booking?.confirmation_code as string | null,
        bookingId,
      }),
      guestName: (booking?.contact_name as string | null) ?? null,
    });
  }

  const openDueBtn = stays.reduce(
    (s, r) => s + (Math.abs(r.dueBtn) > 0.5 ? r.dueBtn : 0),
    0,
  );
  const paidBtn = payments.reduce((s, p) => s + p.amountBtn, 0);

  const jobs: AgentLivingJob[] = [];
  for (const h of openHolds) {
    jobs.push({
      id: `hold-${h.id}`,
      kind: "hold",
      rank: 1,
      title: h.confirmationLabel,
      why: `Hold · ${h.checkIn} → ${h.checkOut}`,
      cta: "Open stay",
      href: `/agents/app/stays/${h.id}`,
    });
  }
  for (const a of arrivalsToday) {
    if (a.status === "checked_in") continue;
    jobs.push({
      id: `arr-${a.id}`,
      kind: "arrival",
      rank: 2,
      title: a.guestName ?? a.confirmationLabel,
      why: "Arrival today — registration at desk",
      cta: "Stay",
      href: `/agents/app/stays/${a.id}`,
    });
  }
  for (const c of checkoutsToday) {
    if (c.status === "checked_out" || c.status === "settled") continue;
    jobs.push({
      id: `co-${c.id}`,
      kind: "checkout",
      rank: Math.abs(c.dueBtn) > 0.5 ? 1 : 3,
      title: c.guestName ?? c.confirmationLabel,
      why:
        Math.abs(c.dueBtn) > 0.5
          ? `Due-out · balance open`
          : "Due-out today",
      cta: "Checkout",
      href: `/agents/app/stays/${c.id}`,
    });
  }
  for (const s of inHouse) {
    if (Math.abs(s.dueBtn) <= 0.5) continue;
    if (s.checkOut === today) continue;
    jobs.push({
      id: `due-${s.id}`,
      kind: "due",
      rank: 4,
      title: s.guestName ?? s.confirmationLabel,
      why: "In-house with open due",
      cta: "Pay / proof",
      href: `/agents/app/stays/${s.id}#payment-proof`,
    });
  }
  jobs.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
  const doJobs = jobs.slice(0, 24);

  const reports: AgentLivingReport[] = [
    {
      label: "Arrivals today",
      value: String(arrivalsToday.length),
      href: "/agents/app/guests",
      warn: arrivalsToday.length > 0,
    },
    {
      label: "Checkouts today",
      value: String(checkoutsToday.length),
      href: "/agents/app/checkouts",
      warn: unpaidCheckouts.length > 0,
    },
    {
      label: "In-house",
      value: String(inHouse.length),
      href: "/agents/app/stays",
    },
    {
      label: "Open due",
      value: String(Math.round(openDueBtn)),
      href: "/agents/app/money",
      warn: Math.abs(openDueBtn) > 0.5,
    },
    {
      label: "Invoices",
      value: String(invoices.length),
      href: "/agents/app/invoices",
    },
    {
      label: "Payments",
      value: String(payments.length),
      href: "/agents/app/payments",
    },
  ];

  const checks: AgentLivingCheck[] = [];
  if (openHolds.length) {
    checks.push({
      id: "holds",
      title: `${openHolds.length} open hold${openHolds.length === 1 ? "" : "s"}`,
      hint: "Confirm with hotel before the timer ends",
      href: "/agents/app/stays",
    });
  }
  if (unpaidCheckouts.length) {
    checks.push({
      id: "co-due",
      title: "Checkout with open balance",
      hint: "Upload payment proof or settle with desk",
      href: "/agents/app/checkouts",
    });
  }
  if (guests.length === 0 && stays.some((s) => s.status === "checked_in")) {
    checks.push({
      id: "reg",
      title: "No guest registration rows yet",
      hint: "Desk captures IDs at check-in — refresh after arrival",
      href: "/agents/app/guests",
    });
  }

  const parts: string[] = [];
  if (doJobs.length) parts.push(`${doJobs.length} job${doJobs.length === 1 ? "" : "s"}`);
  if (arrivalsToday.length) parts.push(`${arrivalsToday.length} arrival${arrivalsToday.length === 1 ? "" : "s"} today`);
  if (checkoutsToday.length) parts.push(`${checkoutsToday.length} checkout${checkoutsToday.length === 1 ? "" : "s"} today`);
  if (inHouse.length) parts.push(`${inHouse.length} in-house`);
  if (Math.abs(openDueBtn) > 0.5) parts.push("open dues");
  const briefing =
    parts.length > 0
      ? parts.join(" · ")
      : `Quiet day · ${stays.length} stay${stays.length === 1 ? "" : "s"} on file`;

  return {
    today,
    briefing,
    doJobs,
    reports,
    checks,
    stays,
    arrivalsToday,
    arrivalsSoon,
    inHouse,
    checkoutsToday,
    recentCheckouts,
    openHolds,
    guests,
    invoices,
    payments,
    metrics: {
      arrivalsToday: arrivalsToday.length,
      checkoutsToday: checkoutsToday.length,
      inHouse: inHouse.length,
      openHolds: openHolds.length,
      openDueBtn,
      unpaidCheckouts: unpaidCheckouts.length,
      invoiceCount: invoices.length,
      paidBtn,
    },
  };
}
