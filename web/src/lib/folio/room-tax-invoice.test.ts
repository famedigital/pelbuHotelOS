import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { amountInWordsPayable } from "../print/amount-in-words";
import { buildRoomTaxInvoice, receivedCoversMasterBill } from "./room-tax-invoice";

describe("room tax invoice", () => {
  it("keeps each room on its own line and nights × rate = amount", () => {
    const bill = buildRoomTaxInvoice(
      [
        {
          id: "a1",
          source_type: "room",
          description: "Room 303 · 2026-10-09",
          business_date: "2026-10-09",
          qty: 1,
          unit_price_btn: 4848.4818,
          amount_btn: 4848.4818,
          service_charge_btn: 484.84818,
          gst_btn: 0,
          total_btn: 5333.33,
        },
        {
          id: "a2",
          source_type: "room",
          description: "Room 303 · 2026-10-10",
          business_date: "2026-10-10",
          qty: 1,
          unit_price_btn: 4848.4818,
          amount_btn: 4848.4818,
          service_charge_btn: 484.84818,
          gst_btn: 0,
          total_btn: 5333.33,
        },
        {
          id: "b",
          source_type: "extra_bed",
          description: "Extra bed Room 303",
          business_date: "2026-10-09",
          qty: 1,
          unit_price_btn: 1363.6364,
          amount_btn: 1363.6364,
          service_charge_btn: 136.36364,
          gst_btn: 0,
          total_btn: 1500,
        },
      ],
      { mealPlanCode: "MAP" },
    );
    assert.equal(bill.rows.length, 2);
    assert.equal(bill.rows[0]?.description, "Room-303");
    assert.equal(bill.rows[0]?.nights, 2);
    assert.equal(bill.rows[0]?.rate, 4848.4818);
    assert.equal(bill.rows[0]?.amount, exact(2 * 4848.4818));
    assert.equal(bill.rows[0]?.arrival, "9/10/2026");
    assert.equal(bill.rows[0]?.departure, "11/10/2026");
    assert.equal(bill.rows[1]?.description, "Extra bed-303");
    assert.equal(bill.rows[1]?.amount, exact(1 * 1363.6364));
    assert.equal(
      bill.rows[0]?.amount,
      exact((bill.rows[0]?.nights ?? 0) * (bill.rows[0]?.rate ?? 0)),
    );
  });

  it("uses food quantity as the factor so quantity × rate = amount", () => {
    const bill = buildRoomTaxInvoice([
      {
        id: "c",
        source_type: "order",
        description: "Desk bar: 1× Coke, 4× Tonic water · guest pays later, not the agent",
        qty: 2,
        unit_price_btn: 100,
        amount_btn: 200,
        service_charge_btn: 20,
        gst_btn: 0,
        total_btn: 220,
      },
    ]);
    assert.equal(bill.rows[0]?.description, "POS BILL");
    assert.equal(bill.rows[0]?.nights, 2);
    assert.equal(bill.rows[0]?.rate, 100);
    assert.equal(bill.rows[0]?.amount, 200);
    assert.equal(bill.serviceCharge, 20);
    assert.equal(bill.net, 220);
  });

  it("prints the folio first, rooms without meals, and breakfast and dinner on the food bill", () => {
    const room = buildRoomTaxInvoice(
      [
        {
          id: "room",
          source_type: "room",
          description: "Room 303 · 2026-10-09",
          business_date: "2026-10-09",
          qty: 1,
          amount_btn: 4000,
          unit_price_btn: 4000,
          service_charge_btn: 400,
          gst_btn: 0,
          total_btn: 4400,
        },
        {
          id: "pos",
          source_type: "order",
          description: "Desk cafe: 3× K5 · guest pays later, not the agent",
          qty: 1,
          amount_btn: 300,
          unit_price_btn: 300,
          service_charge_btn: 30,
          gst_btn: 0,
          total_btn: 330,
        },
      ],
      { bill: "room", folioNo: "PSFN-2026-00013", mealPlanCode: "MAP" },
    );
    assert.deepEqual(
      room.rows.map((row) => row.description),
      ["Room-303"],
    );
    assert.equal(room.rows[0]?.folioNo, "PSRM-2026-00013");
    assert.equal(room.serviceCharge, 400);

    const food = buildRoomTaxInvoice(
      [
        {
          id: "meal",
          source_type: "meal_plan",
          description: "Meal plan MAP · Half board",
          qty: 1,
          amount_btn: 2000,
          unit_price_btn: 2000,
          service_charge_btn: 200,
          gst_btn: 0,
          total_btn: 2200,
        },
      ],
      {
        bill: "fnb",
        mealPlanCode: "MAP",
        checkIn: "2026-10-09",
        checkOut: "2026-10-11",
        folioNo: "PSFN-2026-00013",
      },
    );
    assert.deepEqual(
      food.rows.map((row) => row.description),
      ["Breakfast", "Dinner"],
    );
    assert.equal(food.rows[0]?.nights, 2);
    assert.equal(food.rows[0]?.amount, 1000);
    assert.equal(food.rows[1]?.amount, 1000);
    assert.equal(food.rows[0]?.folioNo, "PSFF-2026-00013");

    const breakfast = buildRoomTaxInvoice(
      [
        {
          id: "cp",
          source_type: "meal_plan",
          description: "Meal plan CP",
          amount_btn: 800,
          unit_price_btn: 800,
          service_charge_btn: 80,
          gst_btn: 0,
          total_btn: 880,
        },
      ],
      { bill: "fnb", mealPlanCode: "CP", checkIn: "2026-10-09", checkOut: "2026-10-10" },
    );
    assert.deepEqual(
      breakfast.rows.map((row) => row.description),
      ["Breakfast"],
    );
  });

  it("issues the room tax invoice only once the master bill is covered", () => {
    assert.equal(receivedCoversMasterBill(11200, 11199.96), true);
    assert.equal(receivedCoversMasterBill(11200, 8000), false);
    assert.equal(receivedCoversMasterBill(0, 0), false);
  });

  it("names the room from the type and keeps chetrums in the words", () => {
    const bill = buildRoomTaxInvoice(
      [
        {
          id: "r",
          source_type: "room",
          description: "Room 303 · 2026-10-09",
          business_date: "2026-10-09",
          qty: 1,
          unit_price_btn: 4848.4818,
          amount_btn: 4848.4818,
          service_charge_btn: 484.8482,
          gst_btn: 0,
          total_btn: 5333.33,
        },
      ],
      { mealPlanCode: "MAP", roomNames: { "303": "Deluxe King" } },
    );
    assert.equal(bill.rows[0]?.description, "Deluxe King-303");
    assert.equal(bill.rows[0]?.departure, "10/10/2026");
    assert.equal(
      amountInWordsPayable(6571.43),
      "SIX THOUSAND FIVE HUNDRED SEVENTY-ONE AND 43 / 100",
    );
  });

  it("splits a Nu 3600 single after GST is removed into room, service, and breakfast", () => {
    const roomLines = ["2026-10-22", "2026-10-23", "2026-10-24"].map((day, index) => ({
      id: `n${index}`,
      source_type: "room",
      description: `Room 207 · ${day} · single`,
      business_date: day,
      qty: 1,
      unit_price_btn: 2753.24,
      amount_btn: 2753.24,
      service_charge_btn: 275.33,
      gst_btn: 0,
      total_btn: 3028.57,
    }));
    const foodLine = {
      id: "bf",
      source_type: "meal_plan",
      description: "Breakfast · 1 person · single rate",
      business_date: "2026-10-22",
      qty: 3,
      unit_price_btn: 363.64,
      amount_btn: 1090.92,
      service_charge_btn: 109.08,
      gst_btn: 0,
      total_btn: 1200,
    };
    const room = buildRoomTaxInvoice(roomLines, {
      bill: "room",
      folioNo: "PSFN-2026-00006",
      roomNames: { "207": "Deluxe Queen" },
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
    });
    assert.equal(room.rows[0]?.description, "Single-207");
    assert.equal(room.rows[0]?.nights, 3);
    assert.equal(room.rows[0]?.rate, 2753.24);
    assert.equal(room.serviceCharge, exact(275.33 * 3));
    assert.equal(room.gst, 0);
    assert.equal(room.net, exact(2753.24 * 3 + 275.33 * 3));

    const food = buildRoomTaxInvoice([foodLine], {
      bill: "fnb",
      mealPlanCode: "BB",
      folioNo: "PSFN-2026-00006",
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
    });
    assert.equal(food.rows[0]?.description, "Breakfast");
    assert.equal(food.rows[0]?.nights, 3);
    assert.equal(food.rows[0]?.rate, 363.64);
    assert.equal(food.serviceCharge, 109.08);
    assert.equal(food.net, 1200);

    const master = buildRoomTaxInvoice([...roomLines, foodLine], {
      bill: "master",
      mealPlanCode: "BB",
      folioNo: "PSFN-2026-00006",
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
    });
    assert.equal(room.rows[0]?.folioNo, "PSRM-2026-00006");
    assert.equal(food.rows[0]?.folioNo, "PSFF-2026-00006");
    assert.equal(master.rows.length, 2);
    assert.equal(
      master.rows.find((row) => row.description.startsWith("Single"))?.folioNo,
      "PSRM-2026-00006",
    );
    assert.equal(
      master.rows.find((row) => row.description === "Breakfast")?.folioNo,
      "PSFF-2026-00006",
    );
    assert.equal(master.gst, 0);
    assert.equal(master.net, 10285.71);
    assert.equal(
      amountInWordsPayable(master.net),
      "TEN THOUSAND TWO HUNDRED EIGHTY-FIVE AND 71 / 100",
    );
  });

  it("keeps laundry and an extra mattress off the food bill", () => {
    const lines = [
      {
        id: "bed",
        source_type: "extra_bed",
        description: "Extra mattress",
        qty: 2,
        unit_price_btn: 750,
        amount_btn: 1500,
        service_charge_btn: 0,
        gst_btn: 0,
        total_btn: 1500,
      },
      {
        id: "wash",
        source_type: "laundry",
        description: "Laundry · Same day · Shirt × 1",
        qty: 1,
        unit_price_btn: 150,
        amount_btn: 150,
        service_charge_btn: 15,
        gst_btn: 0,
        total_btn: 165,
      },
      {
        id: "food",
        source_type: "pos",
        description: "Momos",
        qty: 1,
        unit_price_btn: 200,
        amount_btn: 200,
        service_charge_btn: 0,
        gst_btn: 0,
        total_btn: 200,
      },
    ];
    const food = buildRoomTaxInvoice(lines, { bill: "fnb", folioNo: "PSFN-1" });
    assert.deepEqual(
      food.rows.map((row) => row.description),
      ["POS BILL"],
    );
    const room = buildRoomTaxInvoice(lines, { bill: "room", folioNo: "PSFN-1" });
    assert.deepEqual(
      room.rows.map((row) => row.description),
      ["Extra mattress"],
    );
    assert.equal(room.rows[0]?.nights, 2);
    assert.equal(room.rows[0]?.rate, 750);
    const master = buildRoomTaxInvoice(lines, { bill: "master", folioNo: "PSFN-1" });
    assert.deepEqual(
      master.rows.map((row) => row.description),
      ["Extra mattress", "POS BILL", "Same day · Shirt × 1"],
    );
  });
});

function exact(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 10000) / 10000;
}
