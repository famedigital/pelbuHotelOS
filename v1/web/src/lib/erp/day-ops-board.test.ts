import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catchUpKind } from "./day-ops-board";

const day = "2026-10-23";

describe("catchUpKind", () => {
  it("flags a stay that should already be in house", () => {
    assert.equal(
      catchUpKind(
        { status: "confirmed", check_in: "2026-10-21", check_out: "2026-10-24" },
        day,
      ),
      "overdue_arrival",
    );
    assert.equal(
      catchUpKind(
        { status: "pending", check_in: "2026-10-22", check_out: "2026-10-23" },
        day,
      ),
      "overdue_arrival",
    );
  });

  it("flags a guest who should already have left", () => {
    assert.equal(
      catchUpKind(
        { status: "checked_in", check_in: "2026-10-18", check_out: "2026-10-22" },
        day,
      ),
      "overdue_departure",
    );
  });

  it("leaves today's arrival and today's departure on the normal boards", () => {
    assert.equal(
      catchUpKind(
        { status: "confirmed", check_in: day, check_out: "2026-10-25" },
        day,
      ),
      null,
    );
    assert.equal(
      catchUpKind(
        { status: "checked_in", check_in: "2026-10-21", check_out: day },
        day,
      ),
      null,
    );
  });

  it("ignores checked-in guests and finished stays", () => {
    assert.equal(
      catchUpKind(
        { status: "checked_in", check_in: "2026-10-21", check_out: "2026-10-25" },
        day,
      ),
      null,
    );
    assert.equal(
      catchUpKind(
        { status: "checked_out", check_in: "2026-10-18", check_out: "2026-10-20" },
        day,
      ),
      null,
    );
    assert.equal(
      catchUpKind(
        { status: "confirmed", check_in: "2026-10-10", check_out: "2026-10-12" },
        day,
      ),
      null,
    );
  });
});
