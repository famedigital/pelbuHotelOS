import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDemoOrSeedProperty,
  mergeConnectedHotels,
  preferInnoraHotelId,
  resolveInnoraHotels,
  resolvePartnerAgent,
} from "./partner-hotels.js";
import { DEMO_MOU_PROPERTY_ID } from "./mou-store.js";
import type { Agent } from "./commercial-store.js";

describe("partner-hotels", () => {
  it("filters seed and demo properties", () => {
    assert.equal(
      isDemoOrSeedProperty({
        id: DEMO_MOU_PROPERTY_ID,
        name: "Demo Hotel · Thimphu",
      }),
      true,
    );
    assert.equal(
      isDemoOrSeedProperty({
        id: "d06e89f8-86e6-4201-bbd2-5e115d422357",
        slug: "pelbu-olakha",
        name: "Pelbu Suites Olakha",
      }),
      false,
    );
  });

  it("prefers portal Innora hotels over demo MoU links", () => {
    const hotels = resolveInnoraHotels({
      portalProperties: [
        {
          id: "d06e89f8-86e6-4201-bbd2-5e115d422357",
          slug: "pelbu-olakha",
          name: "Pelbu Suites Olakha",
        },
      ],
      mouLinks: [
        {
          id: "mou-demo",
          propertyId: DEMO_MOU_PROPERTY_ID,
          propertyName: "Demo Hotel · Thimphu",
          agentId: "uuid-soul",
          agentName: "SOULTRIPS",
          status: "active",
          initiatedBy: "hotel",
          proposedByActor: "desk",
          decidedByActor: null,
          proposedAt: "",
          decidedAt: null,
          expiresAt: null,
          creditLimitBtn: 200000,
          rateCardId: null,
          notes: "",
        },
      ],
      agentId: "uuid-soul",
    });
    assert.equal(hotels.length, 1);
    assert.equal(hotels[0]!.propertyName, "Pelbu Suites Olakha");
    assert.equal(preferInnoraHotelId(hotels), hotels[0]!.propertyId);
  });

  it("synthesizes partner agent from portal meta when subjectId unknown", () => {
    const agents: Agent[] = [
      {
        id: "ag-yap",
        name: "Yangphel Adventure Travel",
        code: "YAP",
        contact: "",
        creditLimit: 500000,
        usedCredit: 0,
        termsDays: 30,
        rateCardId: "rc-agt-common",
        aging: { current: 0, d30: 0, d60: 0, d90: 0 },
        active: true,
      },
    ];
    const agent = resolvePartnerAgent(agents, "uuid-soul", {
      displayName: "SOULTRIPS",
      loginCode: "SOULTRIPS",
    });
    assert.equal(agent.id, "uuid-soul");
    assert.equal(agent.name, "SOULTRIPS");
    assert.equal(agent.code, "SOULTRIPS");
    assert.notEqual(agent.id, "ag-yap");
  });

  it("merges connected hotels without demo when live portal hotels exist", () => {
    const merged = mergeConnectedHotels(
      [
        {
          propertyId: DEMO_MOU_PROPERTY_ID,
          propertyName: "Demo Hotel · Thimphu",
          mouStatus: "active",
          creditLimitBtn: 1,
          rateCardId: null,
          rateCardCode: "—",
          doubleNet: null,
          offerCount: 0,
          staysHeld: 0,
          staysInHouse: 0,
          staysArriving: 0,
          arOutstanding: 0,
          paidTotal: 0,
          mouId: "x",
        },
      ],
      [
        {
          propertyId: "pelbu-id",
          propertyName: "Pelbu Suites Olakha",
          slug: "pelbu-olakha",
          mouStatus: "active",
        },
      ],
      null,
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.propertyName, "Pelbu Suites Olakha");
  });
});
