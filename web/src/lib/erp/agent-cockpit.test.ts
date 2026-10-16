import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentHubBookingHref, buildAgentCockpit } from "./agent-cockpit";
import type { AgentDossier } from "@/lib/reports/agent-dossier";
import { emptyAging } from "@/lib/reports/ar-aging";

function stubDossier(over: Partial<AgentDossier> = {}): AgentDossier {
  const base: AgentDossier = {
    agent: {
      id: "a1",
      company_name: "Little Bhutan",
      market: "Bhutan",
      contact_name: "Tashi",
      contact_phone: "+975",
      contact_email: null,
      status: "approved",
      rate_tier: "agents",
      credit_limit: 100000,
      credit_used: 1000,
      open_room_cap: 15,
      dzongkhag: null,
      license_url: null,
      notes: null,
      wants_mou: false,
      approved_at: null,
      created_at: "2026-01-01",
      portal_token: null,
    },
    from: "2026-10-01",
    to: "2026-10-31",
    today: "2026-10-17",
    bookings: [
      {
        id: "b1",
        contact_name: "Erik",
        contact_phone: null,
        check_in: "2026-10-15",
        check_out: "2026-10-17",
        status: "checked_in",
        rooms: 1,
        quoted_total_btn: 10000,
        folio_id: "f1",
        folio_label: "F1",
        nights: 2,
        balance_btn: 5000,
      },
    ],
    bookingsInRange: [],
    guests: [],
    rooms: [],
    money: {
      folioTotal: 10000,
      paid: 0,
      outstanding: 5000,
      aging: emptyAging(),
      payments: [],
      ledger: [],
      habit: {
        paymentCount: 0,
        creditSharePct: 0,
        cashLikeSharePct: 0,
        avgDaysToPay: null,
        blurb: "No payments yet",
      },
      openRoomsInHouse: 1,
      packs: [],
      openItems: [],
    },
    rates: [],
    allotments: [],
    summary: { bookingCount: 1, roomNights: 2, quotedTotal: 10000 },
  };
  return { ...base, ...over, agent: { ...base.agent, ...(over.agent ?? {}) } };
}

describe("agent cockpit", () => {
  it("ranks collect for in-house with due", () => {
    const { doJobs, briefing } = buildAgentCockpit(stubDossier());
    assert.ok(doJobs.some((j) => j.kind === "collect" || j.kind === "checkout"));
    assert.match(briefing, /owes|job/i);
  });

  it("hub href uses stayview", () => {
    const href = agentHubBookingHref(
      "b1",
      "checked_in",
      "2026-10-15",
      "2026-10-20",
      "2026-10-17",
    );
    assert.match(href, /^\/erp\/stayview\?booking=b1/);
    assert.match(href, /step=stay_money/);
  });
});
