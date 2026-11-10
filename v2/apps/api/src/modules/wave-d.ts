import {
  assertCashTender,
  assertNoClientPrice,
  assertVoidPin,
  permission,
  resolveServerLineNet,
  settleFiscalForTender,
  type PosTenderKind,
} from "@hos-v2/domain";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { store } from "../platform/memory-store.js";
import { commandHandlers, registerCommand } from "./registry.js";

const MANAGER_PIN = "1234";

const tenderSchema = z.enum([
  "cash",
  "card",
  "rma_qr",
  "city_ledger",
  "room_charge",
  "agent",
]);

registerCommand("pos.openShift", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      outletId: z.string().uuid(),
      openingFloatBtn: z.number().nonnegative(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  store.ensurePosCatalog(input.propertyId);
  const open = store.posShifts.find(
    (s) =>
      s.propertyId === input.propertyId &&
      s.outletId === input.outletId &&
      s.status === "open",
  );
  if (open) {
    return { ok: false, error: "Shift already open for outlet", code: "SHIFT_OPEN" };
  }
  const shift = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    outletId: input.outletId,
    status: "open" as const,
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingFloatBtn: input.openingFloatBtn,
    closingFloatBtn: null,
  };
  store.posShifts.push(shift);
  ctx.audit({
    action: "pos.openShift",
    entityType: "pos_shift",
    entityId: shift.id,
    after: shift,
  });
  return { ok: true, data: shift };
});

registerCommand("pos.closeShift", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      shiftId: z.string().uuid(),
      closingFloatBtn: z.number().nonnegative(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const shift = store.posShifts.find(
    (s) => s.id === input.shiftId && s.propertyId === input.propertyId,
  );
  if (!shift || shift.status !== "open") {
    return { ok: false, error: "Open shift not found", code: "SHIFT" };
  }
  const unsettled = store.posOrders.filter(
    (o) =>
      o.propertyId === input.propertyId &&
      o.outletId === shift.outletId &&
      (o.status === "open" || o.status === "fired" || o.status === "billed"),
  );
  if (unsettled.length > 0) {
    return {
      ok: false,
      error: `${unsettled.length} unsettled POS bill(s) — settle before close`,
      code: "UNSETTLED",
    };
  }
  shift.status = "closed";
  shift.closedAt = new Date().toISOString();
  shift.closingFloatBtn = input.closingFloatBtn;
  ctx.audit({
    action: "pos.closeShift",
    entityType: "pos_shift",
    entityId: shift.id,
    after: shift,
  });
  return { ok: true, data: shift };
});

registerCommand("pos.openOrder", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      outletId: z.string().uuid().optional(),
      tableLabel: z.string().min(1).max(32),
      coverCount: z.number().int().positive().default(2),
      bookingId: z.string().uuid().nullable().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const { outletId: defaultOutlet } = store.ensurePosCatalog(input.propertyId);
  const order = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    outletId: input.outletId ?? defaultOutlet,
    tableLabel: input.tableLabel,
    coverCount: input.coverCount,
    status: "open" as const,
    bookingId: input.bookingId ?? null,
    lines: [],
    tender: null,
    invNo: null,
    folioPosted: false,
    net: 0,
    total: 0,
    createdAt: new Date().toISOString(),
  };
  store.posOrders.push(order);
  return { ok: true, data: order };
});

registerCommand("pos.addItem", async (raw, ctx) => {
  const priceGate = assertNoClientPrice(raw);
  if (!priceGate.ok) return priceGate;

  const input = z
    .object({
      propertyId: z.string().uuid(),
      orderId: z.string().uuid(),
      menuItemId: z.string().uuid(),
      qty: z.number().int().positive(),
      note: z.string().max(200).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  store.ensurePosCatalog(input.propertyId);
  const order = store.posOrders.find(
    (o) => o.id === input.orderId && o.propertyId === input.propertyId,
  );
  if (!order || order.status === "settled" || order.status === "void") {
    return { ok: false, error: "Order not open", code: "ORDER" };
  }
  const menu = store.menuItems.find(
    (m) =>
      m.id === input.menuItemId &&
      m.propertyId === input.propertyId &&
      m.active,
  );
  if (!menu) return { ok: false, error: "Menu item not found", code: "MENU" };
  if (menu.eightySixed) {
    return { ok: false, error: "Item is 86'd", code: "EIGHTY_SIX" };
  }
  const priced = resolveServerLineNet({
    menuNetPrice: menu.netPrice,
    qty: input.qty,
  });
  if (!priced.ok) return { ok: false, error: priced.error, code: "POS_PRICE" };

  const line = {
    id: crypto.randomUUID(),
    menuItemId: menu.id,
    name: menu.name,
    station: menu.station,
    qty: input.qty,
    netUnit: menu.netPrice,
    note: input.note,
    voided: false,
  };
  order.lines.push(line);
  order.net = order.lines
    .filter((l) => !l.voided)
    .reduce((s, l) => s + l.netUnit * l.qty, 0);
  order.total = Math.round(order.net * 1.1 * 1.05 * 100) / 100;

  return {
    ok: true,
    data: {
      orderId: order.id,
      line,
      priceSource: "server_menu" as const,
      persisted: "memory" as const,
    },
  };
});

registerCommand("pos.fire", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      orderId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const order = store.posOrders.find(
    (o) => o.id === input.orderId && o.propertyId === input.propertyId,
  );
  if (!order) return { ok: false, error: "Order not found", code: "ORDER" };
  const live = order.lines.filter((l) => !l.voided);
  if (live.length === 0) {
    return { ok: false, error: "No lines to fire", code: "EMPTY" };
  }

  const byStation = new Map<string, typeof live>();
  for (const line of live) {
    const list = byStation.get(line.station) ?? [];
    list.push(line);
    byStation.set(line.station, list);
  }

  const kotIds: string[] = [];
  for (const [station, lines] of byStation) {
    const id = crypto.randomUUID();
    kotIds.push(id);
    store.kotTickets.push({
      id,
      propertyId: input.propertyId,
      orderId: order.id,
      ticketNo: store.nextKotNo(input.propertyId),
      station,
      status: "preparing",
      tableLabel: order.tableLabel,
      createdAt: Date.now(),
      lines: lines.map((l) => ({
        menuItemId: l.menuItemId,
        name: l.name,
        qty: l.qty,
        note: l.note,
      })),
    });
  }
  order.status = "fired";
  ctx.emit({
    type: "pos.fired",
    aggregateType: "pos_order",
    aggregateId: order.id,
    payload: { kotIds },
  });
  return { ok: true, data: { orderId: order.id, status: "fired", kotIds } };
});

registerCommand("pos.voidLine", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      orderId: z.string().uuid(),
      lineId: z.string().uuid(),
      managerPin: z.string().min(4).max(8),
      reason: z.string().min(2).max(200),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const pin = assertVoidPin({
    pinProvided: input.managerPin,
    expectedPin: MANAGER_PIN,
  });
  if (!pin.ok) return pin;

  const order = store.posOrders.find(
    (o) => o.id === input.orderId && o.propertyId === input.propertyId,
  );
  if (!order || order.status === "settled") {
    return { ok: false, error: "Order not voidable", code: "ORDER" };
  }
  const line = order.lines.find((l) => l.id === input.lineId);
  if (!line || line.voided) {
    return { ok: false, error: "Line not found", code: "LINE" };
  }
  line.voided = true;
  order.net = order.lines
    .filter((l) => !l.voided)
    .reduce((s, l) => s + l.netUnit * l.qty, 0);
  order.total = Math.round(order.net * 1.1 * 1.05 * 100) / 100;
  ctx.emit({
    type: "pos.void",
    aggregateType: "pos_order",
    aggregateId: order.id,
    payload: { lineId: line.id, reason: input.reason },
  });
  ctx.audit({
    action: "pos.voidLine",
    entityType: "pos_order_line",
    entityId: line.id,
    reason: input.reason,
  });
  return { ok: true, data: { orderId: order.id, lineId: line.id } };
});

registerCommand("pos.settle", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      orderId: z.string().uuid(),
      tender: tenderSchema,
      cashGivenBtn: z.number().nonnegative().optional(),
      bookingId: z.string().uuid().nullable().optional(),
      folioId: z.string().uuid().nullable().optional(),
      managerPin: z.string().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("pos", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const order = store.posOrders.find(
    (o) => o.id === input.orderId && o.propertyId === input.propertyId,
  );
  if (!order || order.status === "settled" || order.status === "void") {
    return { ok: false, error: "Order not settleable", code: "ORDER" };
  }
  const live = order.lines.filter((l) => !l.voided);
  if (live.length === 0) {
    return { ok: false, error: "No lines to settle", code: "EMPTY" };
  }

  const tender = input.tender as PosTenderKind;
  if (
    (tender === "city_ledger" || tender === "agent") &&
    assertVoidPin({ pinProvided: input.managerPin, expectedPin: MANAGER_PIN }).ok ===
      false
  ) {
    return {
      ok: false,
      error: "Manager PIN required for agent / city ledger",
      code: "PIN",
    };
  }

  order.net = live.reduce((s, l) => s + l.netUnit * l.qty, 0);
  order.total = Math.round(order.net * 1.1 * 1.05 * 100) / 100;

  if (tender === "cash") {
    const cash = assertCashTender({
      totalBtn: order.total,
      cashGivenBtn: input.cashGivenBtn ?? 0,
    });
    if (!cash.ok) return { ok: false, error: cash.error, code: "CASH" };
  }

  if (tender === "room_charge") {
    const bookingId = input.bookingId ?? order.bookingId;
    if (!bookingId) {
      return { ok: false, error: "bookingId required for room charge", code: "ROOM" };
    }
    const folio =
      (input.folioId
        ? store.folios.find(
            (f) => f.id === input.folioId && f.propertyId === input.propertyId,
          )
        : null) ??
      store.folios.find(
        (f) =>
          f.propertyId === input.propertyId &&
          f.bookingId === bookingId &&
          f.payerType === "guest",
      );
    if (!folio || folio.status !== "open") {
      return {
        ok: false,
        error: "Guest folio not found for booking — create reservation first",
        code: "FOLIO",
      };
    }
    const financeFn = commandHandlers.get("finance.postCharge");
    if (!financeFn) {
      return { ok: false, error: "finance.postCharge unavailable", code: "INTERNAL" };
    }
    const charged = await financeFn(
      {
        propertyId: input.propertyId,
        folioId: folio.id,
        description: `POS ${order.tableLabel}`,
        netAmount: order.net,
        kind: "fb",
        stream: "personal",
        idempotencyKey: input.idempotencyKey,
      },
      ctx,
    );
    if (!charged.ok) return charged;
    const chargeData = charged.data as { totalAmount?: number; id?: string };
    order.folioPosted = true;
    order.bookingId = bookingId;
    order.tender = tender;
    order.status = "settled";
    order.invNo = null;
    ctx.emit({
      type: "pos.room_charged",
      aggregateType: "pos_order",
      aggregateId: order.id,
      payload: {
        folioId: folio.id,
        bookingId,
        total: chargeData.totalAmount ?? order.total,
        lineId: chargeData.id,
        issueInv: false,
      },
    });
    ctx.emit({
      type: "pos.items_sold",
      aggregateType: "pos_order",
      aggregateId: order.id,
      payload: {
        lines: live.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
      },
    });
    return {
      ok: true,
      data: {
        orderId: order.id,
        tender,
        issueInv: false,
        invNo: null,
        folioId: folio.id,
        total: chargeData.totalAmount ?? order.total,
      },
    };
  }

  const fiscal = settleFiscalForTender(tender);
  let invNo: string | null = null;
  if (fiscal.issueInv) {
    invNo = store.nextPosInv(input.propertyId);
    order.invNo = invNo;
  }
  order.tender = tender;
  order.status = "settled";
  ctx.emit({
    type: "pos.settled",
    aggregateType: "pos_order",
    aggregateId: order.id,
    payload: { tender, invNo, total: order.total, issueInv: fiscal.issueInv },
  });
  ctx.emit({
    type: "pos.items_sold",
    aggregateType: "pos_order",
    aggregateId: order.id,
    payload: {
      lines: live.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
    },
  });
  return {
    ok: true,
    data: {
      orderId: order.id,
      tender,
      issueInv: fiscal.issueInv,
      invNo,
      total: order.total,
    },
  };
});

registerCommand("kds.bump", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      ticketId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("kds", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const ticket = store.kotTickets.find(
    (t) => t.id === input.ticketId && t.propertyId === input.propertyId,
  );
  if (!ticket) return { ok: false, error: "Ticket not found", code: "KOT" };
  if (ticket.status === "bumped") {
    return { ok: false, error: "Already bumped", code: "KOT" };
  }
  ticket.status = "bumped";
  ctx.emit({
    type: "kot.ready",
    aggregateType: "kot_ticket",
    aggregateId: ticket.id,
    payload: { orderId: ticket.orderId },
  });
  return { ok: true, data: { ticketId: ticket.id, status: "ready" } };
});

registerCommand("kds.recall", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      ticketId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("kds", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const ticket = store.kotTickets.find(
    (t) => t.id === input.ticketId && t.propertyId === input.propertyId,
  );
  if (!ticket) return { ok: false, error: "Ticket not found", code: "KOT" };
  ticket.status = "preparing";
  ticket.createdAt = Date.now();
  return { ok: true, data: { ticketId: ticket.id, status: "preparing" } };
});

registerCommand("kds.mark86", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      menuItemId: z.string().uuid(),
      eightySixed: z.boolean(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("kds", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  store.ensurePosCatalog(input.propertyId);
  const menu = store.menuItems.find(
    (m) => m.id === input.menuItemId && m.propertyId === input.propertyId,
  );
  if (!menu) return { ok: false, error: "Menu item not found", code: "MENU" };
  menu.eightySixed = input.eightySixed;
  ctx.emit({
    type: "item.86",
    aggregateType: "menu_item",
    aggregateId: menu.id,
    payload: { eightySixed: input.eightySixed },
  });
  return { ok: true, data: { menuItemId: menu.id, eightySixed: menu.eightySixed } };
});

registerCommand("housekeeping.setStatus", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      roomId: z.string().uuid(),
      status: z.enum(["dirty", "cleaning", "clean", "inspected", "ooo", "oos"]),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("housekeeping", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const room = store.rooms.find(
    (r) => r.id === input.roomId && r.propertyId === input.propertyId,
  );
  if (room) room.hkStatus = input.status;
  ctx.emit({
    type: "room.status_changed",
    aggregateType: "room",
    aggregateId: input.roomId,
    payload: { status: input.status },
  });
  return { ok: true, data: { roomId: input.roomId, status: input.status } };
});

registerCommand("laundry.deliver", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      orderId: z.string().uuid(),
      folioId: z.string().uuid(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("laundry", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  ctx.emit({
    type: "laundry.delivered",
    aggregateType: "laundry_order",
    aggregateId: input.orderId,
    payload: { folioId: input.folioId },
  });
  return { ok: true, data: { orderId: input.orderId, postedToFolio: true } };
});
