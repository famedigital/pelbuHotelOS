import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  useRamEngine,
  getExpectedCashTillBtn,
} from "@hotel-os/engine";

describe("Hotel OS v2 - @hotel-os/engine (RAM + WAL hooks)", () => {
  beforeEach(() => {
    useRamEngine.setState({
      walQueue: [],
      syncState: "synced",
      expenses: [],
    });
    void useRamEngine.getState().hydrateEngine({
      propertyId: "test-property",
      propertyName: "Paro Test Lodge",
      syncedAt: new Date().toISOString(),
      rooms: [
        {
          id: "rm-101",
          roomNumber: "101",
          floor: 1,
          category: "Deluxe Twin",
          status: "clean",
        },
        {
          id: "rm-102",
          roomNumber: "102",
          floor: 1,
          category: "Deluxe Twin",
          status: "clean",
        },
      ],
      stays: [
        {
          id: "stay-01",
          bookingRef: "PS-2026-0001",
          guestName: "John Smith",
          status: "expected",
          arrivalDate: "2026-11-06",
          departureDate: "2026-11-09",
          mealPlan: "MAP",
          paxAdults: 2,
          paxChildren: 0,
          agencyName: "Druk Asia",
          folioCharges: [],
          totalBilledBtn: 0,
          totalPaidBtn: 0,
          balanceDueBtn: 0,
        },
      ],
      cashTill: {
        openingBalanceBtn: 10000,
        collectedCashBtn: 20000,
        pettyCashOutflowBtn: 0,
        activeShiftStaffName: "Dechen",
        shiftStartedAt: "2026-11-06T08:00:00Z",
        shiftId: null,
      },
      expenses: [],
    });
  });

  it("checks in a stay into room 101", async () => {
    const store = useRamEngine.getState();
    await store.checkInStay("stay-01", "rm-101", "staff-dechen");

    const state = useRamEngine.getState();
    const stay = state.stays.find((s) => s.id === "stay-01");
    const room = state.rooms.find((r) => r.id === "rm-101");

    assert.equal(stay?.status, "in_house");
    assert.equal(stay?.roomId, "rm-101");
    assert.equal(stay?.roomNumber, "101");
    assert.equal(room?.occupiedStayId, "stay-01");
    assert.equal(state.syncState, "offline_buffered");
    assert.equal(state.walQueue.length, 1);
    assert.equal(state.walQueue[0].opType, "check_in");
  });

  it("shifts stay from room 101 to room 102, marking old room dirty", async () => {
    const store = useRamEngine.getState();
    await store.checkInStay("stay-01", "rm-101", "staff-dechen");
    await store.shiftRoom("stay-01", "rm-102", "staff-dechen");

    const state = useRamEngine.getState();
    const stay = state.stays.find((s) => s.id === "stay-01");
    const oldRoom = state.rooms.find((r) => r.id === "rm-101");
    const newRoom = state.rooms.find((r) => r.id === "rm-102");

    assert.equal(stay?.roomId, "rm-102");
    assert.equal(stay?.roomNumber, "102");
    assert.equal(oldRoom?.status, "dirty");
    assert.equal(oldRoom?.occupiedStayId, null);
    assert.equal(newRoom?.occupiedStayId, "stay-01");
  });

  it("checks out stay and marks room dirty", async () => {
    const store = useRamEngine.getState();
    await store.checkInStay("stay-01", "rm-101", "staff-dechen");
    await store.checkOutStay("stay-01", "staff-dechen");

    const state = useRamEngine.getState();
    const stay = state.stays.find((s) => s.id === "stay-01");
    const room = state.rooms.find((r) => r.id === "rm-101");

    assert.equal(stay?.status, "checked_out");
    assert.equal(room?.status, "dirty");
    assert.equal(room?.occupiedStayId, null);
  });

  it("posts a folio charge and updates balance due in RAM", async () => {
    const store = useRamEngine.getState();
    await store.postFolioCharge({
      id: "chg-01",
      stayId: "stay-01",
      description: "Dining: Shakam Paa & Beer",
      category: "fnb",
      quantity: 1,
      rateBtn: 700,
      serviceChargeBtn: 70,
      bstTaxBtn: 77,
      totalBtn: 847,
      postedAt: "2026-11-06T19:00:00Z",
      postedByStaffId: "staff-waiter",
    });

    const state = useRamEngine.getState();
    const stay = state.stays.find((s) => s.id === "stay-01");

    assert.equal(stay?.folioCharges.length, 1);
    assert.equal(stay?.totalBilledBtn, 847);
    assert.equal(stay?.balanceDueBtn, 847);
  });

  it("records front desk till expense and calculates expected cash balance", async () => {
    const store = useRamEngine.getState();
    assert.equal(getExpectedCashTillBtn(store.cashTill), 30000);

    await store.recordExpense({
      id: "exp-01",
      category: "veg_dairy",
      description: "Centenary Farmers Market: Chilies & Datshi",
      amountBtn: 2450,
      paidVia: "front_till",
      supplierName: "Centenary Shed 14",
      recordedByStaffId: "staff-dechen",
      timestamp: "2026-11-06T14:00:00Z",
    });

    const state = useRamEngine.getState();
    assert.equal(state.cashTill.pettyCashOutflowBtn, 2450);
    assert.equal(getExpectedCashTillBtn(state.cashTill), 27550);
  });

  it("settles cash payment and increments collected cash till", () => {
    const store = useRamEngine.getState();
    store.recordCashSettlement(5000);

    const state = useRamEngine.getState();
    assert.equal(state.cashTill.collectedCashBtn, 25000);
  });
});
