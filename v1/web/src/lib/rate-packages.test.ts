import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPackageColumns,
  buildPackageRateCard,
  packageNightTotalBtn,
  splitPackageSellPrice,
} from "./rate-packages";

describe("rate-packages", () => {
  it("package = room share + adult meal share", () => {
    assert.equal(packageNightTotalBtn(5000, 800, 2), 6600);
  });

  it("keeps a MAP sell price split into room and meals", () => {
    const split = splitPackageSellPrice(5600, 1200);
    assert.equal(split.totalBtn, 5600);
    assert.equal(split.mealShareBtn, 1200);
    assert.equal(split.roomShareBtn, 4400);
    assert.equal(split.roomShareBtn + split.mealShareBtn, split.totalBtn);
    assert.equal(splitPackageSellPrice(5600, 9000).mealShareBtn, 5600);
    assert.equal(splitPackageSellPrice(5600, 9000).roomShareBtn, 0);
  });

  it("room only when meal is free/absent", () => {
    assert.equal(packageNightTotalBtn(5000, 0, 2), 5000);
    assert.equal(packageNightTotalBtn(5000, null, 2), 5000);
  });

  it("skips unpriced meal plans for package columns", () => {
    const cols = buildPackageColumns([
      {
        code: "EP",
        name: "Room only",
        amount_btn_per_adult_night: 0,
      },
      {
        code: "BB",
        name: "Bed & breakfast",
        amount_btn_per_adult_night: 500,
      },
      {
        code: "SPA",
        name: "Label only",
        amount_btn_per_adult_night: null,
      },
    ]);
    assert.equal(cols.length, 2);
    assert.equal(cols[0].id, "room_only");
    assert.equal(cols[1].code, "BB");
  });

  it("builds card cells for seasons", () => {
    const card = buildPackageRateCard({
      rooms: [
        {
          id: "r1",
          code: "S",
          name: "Suite",
          amounts: { peak: 8000, lean: 6000 },
        },
      ],
      mealPlans: [
        {
          code: "BB",
          name: "Breakfast",
          amount_btn_per_adult_night: 400,
        },
      ],
    });
    const peak = card.rooms[0].bySeason.peak!;
    const roomOnly = peak.find((c) => c.columnId === "room_only");
    const bb = peak.find((c) => c.columnId === "meal_BB");
    assert.equal(roomOnly?.totalBtn, 8000);
    assert.equal(bb?.totalBtn, 8000 + 800);
    assert.equal(bb?.roomBtn, 8000);
    assert.equal(bb?.mealAdultsBtn, 800);
    assert.equal((bb?.roomBtn ?? 0) + (bb?.mealAdultsBtn ?? 0), bb?.totalBtn);
    assert.equal(bb?.childMealBtn, 200);
  });
});
