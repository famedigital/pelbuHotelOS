import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartneredAgentRow } from "./b2b-portfolio";
import {
  agentHasBookings,
  agentRowsToCsv,
  filterAgentRows,
} from "./agent-list";

function row(partial: Partial<PartneredAgentRow> & Pick<PartneredAgentRow, "agentId" | "name" | "code">): PartneredAgentRow {
  return {
    active: true,
    creditHold: false,
    mouStatus: "none",
    mouPending: false,
    rateCardCode: "—",
    doubleNet: null,
    creditLimit: 100000,
    usedCredit: 0,
    headroom: 100000,
    utilPct: 0,
    aging90: 0,
    arOutstanding: 0,
    paidTotal: 0,
    depositAwaiting: 0,
    staysHeld: 0,
    staysInHouse: 0,
    staysArriving: 0,
    ...partial,
  };
}

describe("agent-list", () => {
  it("gates booking agents vs directory", () => {
    const booked = row({
      agentId: "1",
      name: "Soultrips",
      code: "ST",
      staysInHouse: 2,
    });
    const idle = row({ agentId: "2", name: "Idle Co", code: "IC" });
    assert.equal(agentHasBookings(booked), true);
    assert.equal(agentHasBookings(idle), false);

    const withBookings = filterAgentRows({
      rows: [booked, idle],
      segment: "with_bookings",
      query: "",
      filter: "all",
      sort: "name",
    });
    assert.deepEqual(
      withBookings.map((r) => r.code),
      ["ST"],
    );

    const dir = filterAgentRows({
      rows: [booked, idle],
      segment: "directory",
      query: "",
      filter: "all",
      sort: "name",
    });
    assert.deepEqual(
      dir.map((r) => r.code),
      ["IC"],
    );
  });

  it("keeps FO unpaid 1111 agents on unpaid filter and exports columns", () => {
    const rows = [
      row({
        agentId: "1",
        name: "Soultrips",
        code: "ST",
        arOutstanding: 5000,
        paidTotal: 1000,
        aging90: 200,
        staysArriving: 1,
      }),
      row({
        agentId: "2",
        name: "Clear",
        code: "CL",
        staysInHouse: 1,
      }),
    ];
    const unpaid = filterAgentRows({
      rows,
      segment: "with_bookings",
      query: "",
      filter: "unpaid",
      sort: "unpaid",
    });
    assert.equal(unpaid.length, 1);
    assert.equal(unpaid[0]!.code, "ST");
    const csv = agentRowsToCsv(unpaid);
    assert.match(csv, /Agent,Code,Unpaid/);
    assert.match(csv, /5000\.00/);
  });
});
