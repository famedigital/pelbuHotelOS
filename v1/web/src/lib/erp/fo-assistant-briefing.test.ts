import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeterministicFoBriefing,
  capDoActions,
} from "./fo-assistant-briefing";

describe("fo assistant briefing", () => {
  it("builds quiet shift line", () => {
    const line = buildDeterministicFoBriefing({
      businessDate: "2026-10-17",
      wallToday: "2026-10-17",
      nightAuditStale: false,
      doCount: 0,
      arrivals: 0,
      departures: 0,
      inHouse: 4,
      agentUnpaid: 0,
      missingGuides: 0,
      dueOutUnpaid: 0,
      doKinds: {},
    });
    assert.match(line, /Quiet shift/);
    assert.match(line, /4 in-house/);
  });

  it("lists jobs and arrivals", () => {
    const line = buildDeterministicFoBriefing({
      businessDate: "2026-10-17",
      wallToday: "2026-10-17",
      nightAuditStale: true,
      doCount: 3,
      arrivals: 2,
      departures: 1,
      inHouse: 5,
      agentUnpaid: 1,
      missingGuides: 1,
      dueOutUnpaid: 1,
      doKinds: { check_in: 2 },
    });
    assert.match(line, /Night close/);
    assert.match(line, /3 jobs/);
    assert.match(line, /2 arrivals/);
  });

  it("caps do actions", () => {
    assert.equal(capDoActions(Array.from({ length: 30 }, (_, i) => i)).length, 20);
  });
});
