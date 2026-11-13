import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { store } from "../../platform/memory-store.js";
import {
  filterTelegramEvents,
  formatStayAlert,
  getHermesAlertPrefs,
  notifyStayLifecycleAlert,
  prefEnabled,
  putHermesAlertPrefs,
  resolveAlertChats,
} from "./hermes-notifier.js";

const PROPERTY = "11111111-1111-4111-8111-111111111111";

describe("hermes-notifier", () => {
  beforeEach(() => {
    store.telegramChats = [];
    store.telegramEvents = [];
    store.hermesAlertPrefs.clear();
    store.rooms = [];
  });

  it("pref off skips notify", async () => {
    putHermesAlertPrefs(PROPERTY, [
      {
        kind: "guest_check_in",
        enabled: false,
        sendAt: null,
        roles: ["fo", "agent"],
      },
    ]);
    const booking = {
      id: "22222222-2222-4222-8222-222222222222",
      propertyId: PROPERTY,
      confirmationNo: "T-1",
      status: "checked_in",
      guestId: null,
      guestName: "Test Guest",
      agentId: "ag-1",
      groupId: null,
      checkIn: "2026-11-13",
      checkOut: "2026-11-14",
      source: "direct",
      lines: [],
    };
    const res = await notifyStayLifecycleAlert({
      propertyId: PROPERTY,
      kind: "guest_check_in",
      booking,
    });
    assert.equal(res.skipped, true);
    assert.equal(res.reason, "pref_disabled");
    assert.equal(store.telegramEvents.length, 0);
  });

  it("pref on + agent chat logs event", async () => {
    getHermesAlertPrefs(PROPERTY);
    store.telegramChats.push({
      id: "33333333-3333-4333-8333-333333333333",
      propertyId: PROPERTY,
      chatId: 99,
      chatType: "private",
      role: "agent",
      status: "active",
      displayName: "Soultrips",
      tgUsername: null,
      agentId: "ag-1",
      activeMouPropertyId: null,
      pairedAt: new Date().toISOString(),
      revokedAt: null,
      lastSeenAt: null,
    });
    const booking = {
      id: "22222222-2222-4222-8222-222222222222",
      propertyId: PROPERTY,
      confirmationNo: "T-1",
      status: "checked_in",
      guestId: null,
      guestName: "Test Guest",
      agentId: "ag-1",
      groupId: null,
      checkIn: "2026-11-13",
      checkOut: "2026-11-14",
      source: "direct",
      agencyName: "Soultrips",
      lines: [],
    };
    const res = await notifyStayLifecycleAlert({
      propertyId: PROPERTY,
      kind: "guest_check_in",
      booking,
    });
    assert.equal(res.skipped, false);
    assert.ok(res.eventIds.length >= 1);
    assert.equal(store.telegramEvents[0]?.intent, "guest_check_in");
    assert.equal(store.telegramEvents[0]?.kind, "alert");
  });

  it("resolveAlertChats filters agent id", () => {
    const pref = {
      kind: "guest_check_in" as const,
      enabled: true,
      sendAt: null,
      roles: ["agent" as const],
    };
    store.telegramChats.push(
      {
        id: "a",
        propertyId: PROPERTY,
        chatId: 1,
        chatType: "private",
        role: "agent",
        status: "active",
        displayName: "A",
        tgUsername: null,
        agentId: "ag-1",
        activeMouPropertyId: null,
        pairedAt: "",
        revokedAt: null,
        lastSeenAt: null,
      },
      {
        id: "b",
        propertyId: PROPERTY,
        chatId: 2,
        chatType: "private",
        role: "agent",
        status: "active",
        displayName: "B",
        tgUsername: null,
        agentId: "ag-2",
        activeMouPropertyId: null,
        pairedAt: "",
        revokedAt: null,
        lastSeenAt: null,
      },
    );
    const hits = resolveAlertChats(PROPERTY, pref, {
      id: "x",
      propertyId: PROPERTY,
      confirmationNo: "1",
      status: "checked_in",
      guestId: null,
      guestName: "G",
      agentId: "ag-1",
      groupId: null,
      checkIn: "2026-11-13",
      checkOut: "2026-11-14",
      source: "direct",
      lines: [],
    });
    assert.deepEqual(
      hits.map((h) => h.chatId),
      [1],
    );
  });

  it("filterTelegramEvents by intent and q", () => {
    store.telegramEvents.push(
      {
        id: "e1",
        propertyId: PROPERTY,
        chatId: 1,
        direction: "out",
        intent: "folio_notify",
        kind: "notify",
        status: "ok",
        text: "Balance Nu 100",
        payload: {},
        createdAt: "2026-11-13T10:00:00.000Z",
      },
      {
        id: "e2",
        propertyId: PROPERTY,
        chatId: 1,
        direction: "out",
        intent: "guest_check_in",
        kind: "alert",
        status: "ok",
        text: "Checked in",
        payload: {},
        createdAt: "2026-11-13T11:00:00.000Z",
      },
    );
    const folio = filterTelegramEvents({
      propertyId: PROPERTY,
      intent: "folio_notify",
    });
    assert.equal(folio.events.length, 1);
    const q = filterTelegramEvents({ propertyId: PROPERTY, q: "balance" });
    assert.equal(q.events.length, 1);
  });

  it("formatStayAlert includes guest", () => {
    const text = formatStayAlert(
      "guest_check_out",
      {
        id: "x",
        propertyId: PROPERTY,
        confirmationNo: "C1",
        status: "checked_out",
        guestId: null,
        guestName: "Ada",
        groupId: null,
        checkIn: "2026-11-10",
        checkOut: "2026-11-13",
        source: "direct",
        lines: [],
      },
      "101",
    );
    assert.match(text, /Ada/);
    assert.match(text, /Checked out/);
  });

  it("prefEnabled null when disabled", () => {
    assert.equal(
      prefEnabled(
        [{ kind: "meal_board", enabled: false, sendAt: null, roles: ["fo"] }],
        "meal_board",
      ),
      null,
    );
  });
});
