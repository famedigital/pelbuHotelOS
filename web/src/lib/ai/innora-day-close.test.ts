import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayClosePreview, planDayClose, type DayCloseStay } from "./innora-day-close";

const today = "2026-10-25";

function stay(partial: Partial<DayCloseStay> & Pick<DayCloseStay, "id" | "status" | "checkIn" | "checkOut">): DayCloseStay {
  return {
    name: partial.name ?? partial.id,
    code: partial.code ?? partial.id,
    agentId: partial.agentId ?? null,
    guideSign: partial.guideSign ?? null,
    hasFolio: partial.hasFolio ?? true,
    ...partial,
  };
}

describe("planDayClose", () => {
  it("checks out departures through today and skips a single future stay", () => {
    const changes = planDayClose(
      [
        stay({
          id: "a",
          status: "checked_in",
          checkIn: "2026-10-23",
          checkOut: "2026-10-25",
          agentId: "agent",
          guideSign: null,
          hasFolio: false,
        }),
        stay({
          id: "b",
          status: "confirmed",
          checkIn: "2026-11-01",
          checkOut: "2026-11-03",
        }),
      ],
      today,
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.action, "checkout");
    assert.equal(changes[0]?.waiveGuide, true);
    assert.equal(changes[0]?.wasInHouse, true);
  });

  it("puts today's checked-in arrival back on the arrival list", () => {
    const changes = planDayClose(
      [
        stay({
          id: "arr",
          status: "checked_in",
          checkIn: today,
          checkOut: "2026-10-27",
        }),
      ],
      today,
    );
    assert.equal(changes[0]?.action, "arrival");
  });

  it("moves an overdue confirmed stay into in house", () => {
    const changes = planDayClose(
      [
        stay({
          id: "house",
          status: "confirmed",
          checkIn: "2026-10-24",
          checkOut: "2026-10-27",
        }),
      ],
      today,
    );
    assert.equal(changes[0]?.action, "in_house");
  });

  it("asks for a folio when a departed stay has none", () => {
    const changes = planDayClose(
      [
        stay({
          id: "gone",
          status: "checked_out",
          checkIn: "2026-10-20",
          checkOut: "2026-10-22",
          hasFolio: false,
        }),
      ],
      today,
    );
    assert.equal(changes[0]?.action, "folio");
  });

  it("leaves a signed guide and an in-house stay alone", () => {
    const changes = planDayClose(
      [
        stay({
          id: "house",
          status: "checked_in",
          checkIn: "2026-10-24",
          checkOut: "2026-10-27",
          agentId: "agent",
          guideSign: "signed",
        }),
      ],
      today,
    );
    assert.equal(changes.length, 0);
  });
});

describe("dayClosePreview", () => {
  it("says confirm and that no invoice is created", () => {
    const preview = dayClosePreview(
      planDayClose(
        [
          stay({
            id: "a",
            name: "BBT",
            status: "checked_in",
            checkIn: "2026-10-23",
            checkOut: today,
            hasFolio: true,
          }),
        ],
        today,
      ),
      today,
    );
    assert.match(preview.reply, /Press Confirm/);
    assert.match(preview.reply, /not create any invoice/);
    assert.match(preview.reply, /Guide number is not required/);
    assert.equal(preview.lines[0], "Check out · BBT · a");
  });
});
