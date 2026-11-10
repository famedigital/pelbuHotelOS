import { formatInv, formatPsbn, permission, quoteNight } from "@hos-v2/domain";
import {
  getDb,
  postChargePersist,
  postPaymentPersist,
  voidLineWithReversalPersist,
} from "@hos-v2/db";
import { z } from "zod";
import {
  assertPermission,
  assertProperty,
  idempotencyKeySchema,
} from "../platform/command.js";
import { store } from "../platform/memory-store.js";
import { registerCommand } from "./registry.js";

const postChargeSchema = z.object({
  propertyId: z.string().uuid(),
  folioId: z.string().uuid(),
  description: z.string().min(1),
  netAmount: z.number(),
  kind: z.string().default("charge"),
  stream: z.enum(["master", "personal"]).optional(),
  idempotencyKey: idempotencyKeySchema,
});

registerCommand("finance.postCharge", async (raw, ctx) => {
  const input = postChargeSchema.parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const folio = store.folios.find(
    (f) => f.id === input.folioId && f.propertyId === input.propertyId,
  );
  if (!folio) {
    return { ok: false, error: "Folio not found", code: "NOT_FOUND" };
  }
  if (folio.status !== "open") {
    return { ok: false, error: `Folio is ${folio.status}`, code: "STATE" };
  }

  // Idempotent package re-post (desk may retry after local-only meal sync).
  const prior = store.folioLines.find(
    (l) =>
      l.folioId === folio.id &&
      l.description === input.description &&
      Math.abs(l.net - input.netAmount) < 0.005,
  );
  if (prior) {
    const stream =
      prior.stream ?? (folio.payerType === "agent" ? "master" : "personal");
    const taxPrior = quoteNight(Math.abs(prior.net), "net");
    const signPrior = prior.net < 0 ? -1 : 1;
    return {
      ok: true,
      data: {
        id: prior.id,
        folioId: folio.id,
        propertyId: input.propertyId,
        description: prior.description,
        kind: prior.sourceType,
        stream,
        netAmount: prior.net,
        scAmount: signPrior * taxPrior.serviceChargeBtn,
        gstAmount: signPrior * taxPrior.gstBtn,
        totalAmount: signPrior * taxPrior.totalBtn,
        voided: false,
        postedAt: new Date().toISOString(),
        balance: folio.balance,
        bookingId: folio.bookingId,
        payerType: folio.payerType,
        idempotent: true,
      },
    };
  }

  const tax = quoteNight(Math.abs(input.netAmount), "net");
  const sign = input.netAmount < 0 ? -1 : 1;
  const line = {
    id: crypto.randomUUID(),
    folioId: folio.id,
    propertyId: input.propertyId,
    description: input.description,
    kind: input.kind,
    stream: input.stream ?? (folio.payerType === "agent" ? "master" : "personal"),
    netAmount: sign * tax.amountBtn,
    scAmount: sign * tax.serviceChargeBtn,
    gstAmount: sign * tax.gstBtn,
    totalAmount: sign * tax.totalBtn,
    voided: false,
    postedAt: new Date().toISOString(),
  };

  store.folioLines.push({
    id: line.id,
    folioId: folio.id,
    propertyId: input.propertyId,
    description: line.description,
    net: line.netAmount,
    sourceType: input.kind,
    sourceId: line.id,
    stream: line.stream,
  });
  folio.balance = Math.round((folio.balance + line.totalAmount) * 100) / 100;

  const db = getDb();
  if (db) {
    const persisted = await postChargePersist(db, {
      propertyId: input.propertyId,
      folioId: folio.id,
      lineId: line.id,
      kind: input.kind,
      description: line.description,
      netAmount: line.netAmount,
      scAmount: line.scAmount,
      gstAmount: line.gstAmount,
      totalAmount: line.totalAmount,
      idempotencyKey: input.idempotencyKey,
    });
    if (!persisted.ok) {
      folio.balance = Math.round((folio.balance - line.totalAmount) * 100) / 100;
      store.folioLines = store.folioLines.filter((l) => l.id !== line.id);
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "finance.postCharge",
    entityType: "folio",
    entityId: input.folioId,
    after: { ...line, balance: folio.balance },
  });
  ctx.emit({
    type: "folio.balance_changed",
    aggregateType: "folio",
    aggregateId: input.folioId,
    payload: { delta: line.totalAmount, balance: folio.balance },
  });
  return {
    ok: true,
    data: {
      ...line,
      balance: folio.balance,
      bookingId: folio.bookingId,
      payerType: folio.payerType,
    },
  };
});

const postPaymentSchema = z.object({
  propertyId: z.string().uuid(),
  folioId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(["cash", "card", "mbob", "bank", "agent_credit", "rma_qr", "city_ledger"]),
  idempotencyKey: idempotencyKeySchema,
});

registerCommand("finance.postPayment", async (raw, ctx) => {
  const input = postPaymentSchema.parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const folio = store.folios.find(
    (f) => f.id === input.folioId && f.propertyId === input.propertyId,
  );
  if (!folio) {
    return { ok: false, error: "Folio not found", code: "NOT_FOUND" };
  }
  if (folio.status !== "open") {
    return { ok: false, error: `Folio is ${folio.status}`, code: "STATE" };
  }

  const paymentId = crypto.randomUUID();
  const amount = Math.round(input.amount * 100) / 100;
  store.folioLines.push({
    id: paymentId,
    folioId: folio.id,
    propertyId: input.propertyId,
    description: `Payment · ${input.method}`,
    net: -amount,
    sourceType: "payment",
    sourceId: paymentId,
  });
  folio.balance = Math.round((folio.balance - amount) * 100) / 100;

  const dbPay = getDb();
  if (dbPay) {
    const persisted = await postPaymentPersist(dbPay, {
      propertyId: input.propertyId,
      folioId: folio.id,
      paymentId,
      method: input.method,
      amount,
      idempotencyKey: input.idempotencyKey,
    });
    if (!persisted.ok) {
      folio.balance = Math.round((folio.balance + amount) * 100) / 100;
      store.folioLines = store.folioLines.filter((l) => l.id !== paymentId);
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "finance.postPayment",
    entityType: "folio",
    entityId: input.folioId,
    after: { paymentId, amount, method: input.method, balance: folio.balance },
  });
  ctx.emit({
    type: "payment.received",
    aggregateType: "folio",
    aggregateId: input.folioId,
    payload: { paymentId, amount, method: input.method },
  });
  ctx.emit({
    type: "folio.balance_changed",
    aggregateType: "folio",
    aggregateId: input.folioId,
    payload: { delta: -amount, balance: folio.balance },
  });
  return {
    ok: true,
    data: {
      paymentId,
      amount,
      method: input.method,
      balance: folio.balance,
      bookingId: folio.bookingId,
      payerType: folio.payerType,
      description: `Payment · ${input.method}`,
      totalAmount: -amount,
      netAmount: -amount,
      scAmount: 0,
      gstAmount: 0,
      kind: "payment",
      postedAt: new Date().toISOString(),
    },
  };
});

registerCommand("finance.voidLineWithReversal", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      folioId: z.string().uuid(),
      lineId: z.string().uuid(),
      reason: z.string().min(2).max(200),
      managerPin: z.string().min(4).max(8).optional(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const folio = store.folios.find(
    (f) => f.id === input.folioId && f.propertyId === input.propertyId,
  );
  if (!folio) {
    return { ok: false, error: "Folio not found", code: "NOT_FOUND" };
  }
  const original = store.folioLines.find(
    (l) => l.id === input.lineId && l.folioId === input.folioId,
  );
  if (!original) {
    return { ok: false, error: "Line not found", code: "NOT_FOUND" };
  }
  if (original.sourceType === "payment" || original.sourceType === "reversal") {
    return { ok: false, error: "Cannot void this line kind", code: "STATE" };
  }
  const already = store.folioLines.find(
    (l) => l.sourceType === "reversal" && l.sourceId === original.id,
  );
  if (already) {
    return {
      ok: true,
      data: {
        reversalId: already.id,
        originalLineId: original.id,
        balance: folio.balance,
        description: already.description,
        totalAmount: already.net,
        netAmount: already.net,
        kind: "adjustment",
        postedAt: new Date().toISOString(),
        replay: true,
      },
    };
  }

  const reversalId = crypto.randomUUID();
  const reverseNet = -original.net;
  const description = `Reversal · ${original.description} · ${input.reason}`;
  store.folioLines.push({
    id: reversalId,
    folioId: folio.id,
    propertyId: input.propertyId,
    description,
    net: reverseNet,
    sourceType: "reversal",
    sourceId: original.id,
  });
  // Approximate tax-inclusive delta: original net was stored as net; night audit/pos use totals.
  // For memory lines we stored net only — reverse the same amount on balance.
  const tax = quoteNight(Math.abs(original.net), "net");
  const sign = original.net < 0 ? 1 : -1;
  const delta = sign * tax.totalBtn;
  const prevBalance = folio.balance;
  folio.balance = Math.round((folio.balance + delta) * 100) / 100;

  const dbVoid = getDb();
  if (dbVoid) {
    const persisted = await voidLineWithReversalPersist(dbVoid, {
      propertyId: input.propertyId,
      folioId: folio.id,
      reversalId,
      originalLineId: original.id,
      description,
      netAmount: reverseNet,
      scAmount: sign * tax.serviceChargeBtn,
      gstAmount: sign * tax.gstBtn,
      totalAmount: delta,
      idempotencyKey: input.idempotencyKey,
    });
    if (!persisted.ok) {
      store.folioLines = store.folioLines.filter((l) => l.id !== reversalId);
      folio.balance = prevBalance;
      return { ok: false, error: persisted.error, code: "PERSIST" };
    }
  }

  ctx.audit({
    action: "finance.voidLineWithReversal",
    entityType: "folio_line",
    entityId: original.id,
    reason: input.reason,
    after: { reversalId, balance: folio.balance },
  });
  ctx.emit({
    type: "folio.balance_changed",
    aggregateType: "folio",
    aggregateId: folio.id,
    payload: { delta, balance: folio.balance, reversalOf: original.id },
  });
  return {
    ok: true,
    data: {
      reversalId,
      originalLineId: original.id,
      balance: folio.balance,
      description: `Reversal · ${original.description}`,
      totalAmount: delta,
      netAmount: reverseNet,
      kind: "adjustment",
      postedAt: new Date().toISOString(),
    },
  };
});

const issueFiscalSchema = z.object({
  propertyId: z.string().uuid(),
  folioId: z.string().uuid(),
  kind: z.enum(["PSBN", "INV"]),
  seq: z.number().int().positive(),
  year: z.number().int().optional(),
  idempotencyKey: idempotencyKeySchema,
});

registerCommand("finance.issueFiscalDoc", async (raw, ctx) => {
  const input = issueFiscalSchema.parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("finance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;

  const year = input.year ?? new Date().getFullYear();
  const docNo =
    input.kind === "PSBN" ? formatPsbn(input.seq, year) : formatInv(input.seq, year);
  const id = crypto.randomUUID();
  ctx.audit({
    action: "finance.issueFiscalDoc",
    entityType: "fiscal_doc",
    entityId: id,
    after: { docNo, kind: input.kind },
  });
  ctx.emit({
    type: "fiscal_doc.issued",
    aggregateType: "fiscal_doc",
    aggregateId: id,
    payload: { docNo, kind: input.kind, folioId: input.folioId },
  });
  return { ok: true, data: { id, docNo, kind: input.kind } };
});

registerCommand("compliance.generateReturn", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      periodFrom: z.string(),
      periodTo: z.string(),
      idempotencyKey: idempotencyKeySchema,
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("compliance", "write")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return {
    ok: true,
    data: {
      filingId: crypto.randomUUID(),
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      status: "draft",
    },
  };
});

registerCommand("reports.run", async (raw, ctx) => {
  const input = z
    .object({
      propertyId: z.string().uuid(),
      reportId: z.string().min(1),
      date: z.string(),
    })
    .parse(raw);
  const denied =
    assertPermission(ctx.actor, permission("reports", "view")) ??
    assertProperty(ctx.actor, input.propertyId);
  if (denied) return denied;
  return {
    ok: true,
    data: {
      reportId: input.reportId,
      date: input.date,
      rows: [] as unknown[],
      note: "Query rewritten for schema v2 in Wave C binders",
    },
  };
});
