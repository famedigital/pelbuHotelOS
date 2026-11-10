/**
 * Wave I — enterprise ops laws: cash advance, tip pool, dual-folio checkout gate.
 * Hard-law writes require DATABASE_URL (no memory fallback).
 * SOURCE-MAP: REINVENT persist into schema v2; domain gates COPY/REINVENT from ops-laws.
 */
import {
  assertCashBillHasAdvance,
  assertPersonalFolioCleared,
  canIssueCashAdvance,
  distributeScTipPool,
  maskPartnerCalendar,
  permission,
  PERSONAL_CHECKOUT_GATE_BTN,
  reconcileCashAdvance,
  type CashAdvance,
  type PartnerCalendarCell,
} from "@hos-v2/domain";
import {
  importBankStatementPersist,
  issueAdvancePersist,
  listAdvances,
  listImmigrationManifest,
  matchBankStatementLinePersist,
  postCashBillPersist,
  reconcileAdvancePersist,
  requireDb,
  runScTipPoolPersist,
  type PersistedAdvance,
} from "@hos-v2/db";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { parseBankStatementText } from "../lib/bank-parsers.js";
import { store } from "../platform/memory-store.js";
import { registerCommand, MODULE_REGISTRY } from "./registry.js";

MODULE_REGISTRY.push(
  { id: "utilities", wave: "C", path: "/utilities", title: "Utilities", status: "commands" },
  { id: "amc", wave: "C", path: "/amc", title: "AMC", status: "commands" },
  { id: "bank-recon", wave: "C", path: "/bank-recon", title: "Bank recon", status: "commands" },
);

function toCashAdvance(row: PersistedAdvance): CashAdvance & { propertyId: string; purpose: string } {
  return {
    id: row.id,
    propertyId: row.propertyId,
    amountBtn: row.amountBtn,
    spentBtn: row.spentBtn,
    changeReturnedBtn: row.changeReturnedBtn,
    status: row.status,
    purpose: row.purpose,
  };
}

registerCommand("procurement.issueAdvance", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      amountBtn: z.number().positive(),
      tillBalanceBtn: z.number().nonnegative(),
      purpose: z.string().default("cfm_market"),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("purchases", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const gate = canIssueCashAdvance({
    amountBtn: input.amountBtn,
    tillBalanceBtn: input.tillBalanceBtn,
  });
  if (!gate.ok) return { ok: false, error: gate.error };

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const persisted = await issueAdvancePersist(dbGate.db, {
    propertyId: input.propertyId,
    amountBtn: input.amountBtn,
    tillBalanceBtn: input.tillBalanceBtn,
    purpose: input.purpose,
    idempotencyKey: input.idempotencyKey,
    // Staff FK only when row exists in v2.staff (desk actor may be pre-seed).
    issuedByStaffId: null,
  });
  if (!persisted.ok) return { ok: false, error: persisted.error };

  const row = toCashAdvance(persisted.advance);
  if (!persisted.replay) {
    ctx.emit({
      type: "procurement.advance_issued",
      aggregateType: "procurement_advance",
      aggregateId: row.id,
      payload: {
        amountBtn: input.amountBtn,
        tillAfterBtn: persisted.tillAfterBtn,
        idempotencyKey: input.idempotencyKey,
      },
    });
    ctx.audit({
      action: "procurement.issueAdvance",
      entityType: "procurement_advance",
      entityId: row.id,
      after: row,
    });
  }
  return {
    ok: true,
    data: {
      advanceId: row.id,
      tillAfterBtn: persisted.tillAfterBtn,
      advance: row,
      replay: persisted.replay,
    },
  };
});

registerCommand("procurement.reconcileAdvance", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      advanceId: z.string().uuid(),
      spentBtn: z.number().nonnegative(),
      changeReturnedBtn: z.number().nonnegative(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("purchases", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const listed = await listAdvances(dbGate.db, input.propertyId);
  const existing = listed.find((a) => a.id === input.advanceId);
  if (!existing) return { ok: false, error: "ADVANCE_NOT_FOUND" };

  const rec = reconcileCashAdvance({
    advance: toCashAdvance(existing),
    spentBtn: input.spentBtn,
    changeReturnedBtn: input.changeReturnedBtn,
  });
  if (!rec.ok) return { ok: false, error: rec.error };

  const persisted = await reconcileAdvancePersist(dbGate.db, {
    propertyId: input.propertyId,
    advanceId: input.advanceId,
    spentBtn: input.spentBtn,
    changeReturnedBtn: input.changeReturnedBtn,
    tillCreditBtn: rec.tillCreditBtn,
    idempotencyKey: input.idempotencyKey,
  });
  if (!persisted.ok) return { ok: false, error: persisted.error };

  if (!persisted.replay) {
    ctx.emit({
      type: "procurement.advance_reconciled",
      aggregateType: "procurement_advance",
      aggregateId: input.advanceId,
      payload: {
        spentBtn: input.spentBtn,
        changeReturnedBtn: input.changeReturnedBtn,
        tillCreditBtn: persisted.tillCreditBtn,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }
  return {
    ok: true,
    data: {
      advance: toCashAdvance(persisted.advance),
      tillCreditBtn: persisted.tillCreditBtn,
      replay: persisted.replay,
    },
  };
});

registerCommand("procurement.postCashBill", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      advanceId: z.string().uuid(),
      billNo: z.string().min(1),
      grandTotalBtn: z.number().positive(),
      paymentMode: z.literal("cash"),
      supplierName: z.string().optional(),
      category: z
        .enum(["meat", "vegetables", "dairy", "dry_goods", "cfm"])
        .optional(),
      items: z
        .array(
          z.object({
            itemName: z.string().min(1),
            category: z.string().min(1),
            qty: z.number().positive(),
            unit: z.string().min(1),
            unitCostBtn: z.number().nonnegative(),
            lineTotalBtn: z.number().positive(),
            stallNo: z.string().optional(),
          }),
        )
        .optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("purchases", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const listed = await listAdvances(dbGate.db, input.propertyId);
  const advanceRow = listed.find((a) => a.id === input.advanceId) ?? null;
  const advance = advanceRow ? toCashAdvance(advanceRow) : null;
  const gate = assertCashBillHasAdvance({
    paymentMode: input.paymentMode,
    advanceId: input.advanceId,
    advance,
  });
  if (!gate.ok) return { ok: false, error: gate.error };

  const persisted = await postCashBillPersist(dbGate.db, {
    propertyId: input.propertyId,
    advanceId: input.advanceId,
    billNo: input.billNo,
    grandTotalBtn: input.grandTotalBtn,
    supplierName: input.supplierName,
    category: input.category,
    items: input.items,
    idempotencyKey: input.idempotencyKey,
  });
  if (!persisted.ok) return { ok: false, error: persisted.error };

  if (!persisted.replay) {
    ctx.emit({
      type: "procurement.cash_bill_posted",
      aggregateType: "procurement_bill",
      aggregateId: persisted.billId,
      payload: {
        advanceId: input.advanceId,
        billNo: input.billNo,
        grandTotalBtn: input.grandTotalBtn,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }
  return { ok: true, data: { billId: persisted.billId, replay: persisted.replay } };
});

registerCommand("hr.runScTipPool", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      periodYm: z.string().regex(/^\d{4}-\d{2}$/),
      poolBtn: z.number().nonnegative(),
      staff: z.array(
        z.object({
          staffId: z.string().uuid(),
          tipPoints: z.number().positive(),
          daysWorked: z.number().nonnegative(),
        }),
      ),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("hr", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const result = distributeScTipPool(input.poolBtn, input.staff);
  const persisted = await runScTipPoolPersist(dbGate.db, {
    propertyId: input.propertyId,
    periodYm: input.periodYm,
    poolBtn: input.poolBtn,
    totalPointDays: result.totalPointDays,
    lines: result.lines,
  });
  if (!persisted.ok) {
    return {
      ok: false,
      error: persisted.error,
      data: { missingStaffIds: persisted.missingStaffIds },
    };
  }

  if (!persisted.replay) {
    ctx.emit({
      type: "hr.sc_tip_pool_generated",
      aggregateType: "sc_tip_pool_run",
      aggregateId: persisted.runId,
      payload: {
        periodYm: input.periodYm,
        poolBtn: input.poolBtn,
        totalPointDays: result.totalPointDays,
        lines: result.lines,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }
  return {
    ok: true,
    data: { runId: persisted.runId, replay: persisted.replay, ...result },
  };
});

registerCommand("stay.assertCheckoutGate", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bookingId: z.string().uuid(),
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("desk", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  store.ensureDemoProperty(input.propertyId);
  const booking = store.bookings.find(
    (b) => b.id === input.bookingId && b.propertyId === input.propertyId,
  );
  if (!booking) {
    return { ok: false, error: "Booking not found", code: "NOT_FOUND" };
  }
  const folios = store.folios
    .filter((f) => f.bookingId === input.bookingId && f.propertyId === input.propertyId)
    .map((f) => ({
      payerType: f.payerType,
      balanceBtn: f.balance,
    }));
  if (folios.length === 0) {
    return { ok: false, error: "No folio for booking", code: "NOT_FOUND" };
  }
  const gate = assertPersonalFolioCleared(folios);
  if (!gate.ok) {
    return {
      ok: false,
      error: gate.error,
      data: {
        personalBalanceBtn: gate.personalBalanceBtn,
        gateBtn: PERSONAL_CHECKOUT_GATE_BTN,
      },
    };
  }
  return {
    ok: true,
    data: { cleared: true, gateBtn: PERSONAL_CHECKOUT_GATE_BTN, folios },
  };
});

registerCommand("partner.maskCalendar", async (raw, ctx) => {
  const cellSchema = z.object({
    stayDate: z.string(),
    roomId: z.string(),
    roomNumber: z.string(),
    state: z.enum(["free", "held", "occupied"]),
    ownerAgentId: z.string().nullable(),
    guestName: z.string().nullable(),
    bookingRef: z.string().nullable(),
    netRateBtn: z.number().nullable(),
  });
  const input = z
    .object({
      propertyId: z.string().uuid(),
      viewerAgentId: z.string().uuid(),
      cells: z.array(cellSchema),
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("agents", "read")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  const masked = maskPartnerCalendar(
    input.cells as PartnerCalendarCell[],
    input.viewerAgentId,
  );
  ctx.audit({
    action: "partner.maskCalendar",
    entityType: "partner_calendar",
    entityId: input.viewerAgentId,
    after: { cellCount: masked.length },
  });
  return { ok: true, data: { cells: masked } };
});

registerCommand("compliance.immigrationManifest", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("compliance", "read")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const rows = await listImmigrationManifest(
    dbGate.db,
    input.propertyId,
    input.asOfDate,
  );
  ctx.audit({
    action: "compliance.immigrationManifest",
    entityType: "immigration_manifest",
    after: { asOfDate: input.asOfDate, rowCount: rows.length },
  });
  return { ok: true, data: { asOfDate: input.asOfDate, rows } };
});

registerCommand("finance.parseBankStatementText", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bankCode: z.enum(["bob", "bnb", "drukpnb"]),
      text: z.string().min(1).max(500_000),
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "read")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const parsed = parseBankStatementText(input.bankCode, input.text);
  ctx.audit({
    action: "finance.parseBankStatementText",
    entityType: "bank_statement",
    after: {
      bankCode: input.bankCode,
      lineCount: parsed.lines.length,
      warningCount: parsed.warnings.length,
    },
  });
  return {
    ok: true,
    data: {
      bankCode: parsed.bankCode,
      lines: parsed.lines.map(({ txnDate, description, amountBtn, direction, externalRef }) => ({
        txnDate,
        description,
        amountBtn,
        direction,
        externalRef,
      })),
      warnings: parsed.warnings,
    },
  };
});

registerCommand("finance.importBankStatement", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      bankCode: z.enum(["bob", "bnb", "drukpnb", "tbank"]),
      accountLabel: z.string().min(1),
      statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sourceFilename: z.string().optional(),
      closingBalanceBtn: z.number().optional(),
      lines: z.array(
        z.object({
          txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          description: z.string().min(1),
          amountBtn: z.number().positive(),
          direction: z.enum(["in", "out"]),
          debitBtn: z.number().nonnegative().optional(),
          creditBtn: z.number().nonnegative().optional(),
          balanceBtn: z.number().optional(),
          externalRef: z.string().optional(),
          fingerprint: z.string().optional(),
        }),
      ),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const persisted = await importBankStatementPersist(dbGate.db, input);
  if (!persisted.ok) return { ok: false, error: persisted.error };

  ctx.emit({
    type: "finance.bank_statement_imported",
    aggregateType: "bank_statement",
    aggregateId: persisted.statementId,
    payload: {
      bankCode: input.bankCode,
      lineCount: input.lines.length,
      idempotencyKey: input.idempotencyKey,
    },
  });
  ctx.audit({
    action: "finance.importBankStatement",
    entityType: "bank_statement",
    entityId: persisted.statementId,
    after: { lineCount: input.lines.length },
  });
  return { ok: true, data: { statementId: persisted.statementId } };
});

registerCommand("finance.matchBankStatementLine", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      statementLineId: z.string().uuid(),
      matchKind: z.enum([
        "folio_payment",
        "procurement_advance",
        "journal",
        "manual",
        "mbob_qr",
      ]),
      matchEntityId: z.string().uuid(),
      amountBtn: z.number().positive(),
      matchedByStaffId: z.string().uuid().optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const dbGate = requireDb();
  if (!dbGate.ok) return { ok: false, error: dbGate.error };

  const persisted = await matchBankStatementLinePersist(dbGate.db, {
    propertyId: input.propertyId,
    statementLineId: input.statementLineId,
    matchKind: input.matchKind,
    matchEntityId: input.matchEntityId,
    amountBtn: input.amountBtn,
    matchedByStaffId: input.matchedByStaffId ?? ctx.actor.staffId,
  });
  if (!persisted.ok) return { ok: false, error: persisted.error };

  if (!persisted.replay) {
    ctx.emit({
      type: "finance.bank_line_matched",
      aggregateType: "bank_statement_line",
      aggregateId: input.statementLineId,
      payload: {
        matchId: persisted.matchId,
        matchKind: input.matchKind,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }
  ctx.audit({
    action: "finance.matchBankStatementLine",
    entityType: "bank_statement_line",
    entityId: input.statementLineId,
    after: { matchId: persisted.matchId, matchKind: input.matchKind },
  });
  return {
    ok: true,
    data: { matchId: persisted.matchId, replay: persisted.replay },
  };
});

export async function getProcurementAdvances(propertyId: string) {
  const dbGate = requireDb();
  if (!dbGate.ok) {
    return { ok: false as const, error: dbGate.error, advances: [] as PersistedAdvance[] };
  }
  const advances = await listAdvances(dbGate.db, propertyId);
  return { ok: true as const, advances };
}
