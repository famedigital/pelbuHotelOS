/**
 * Thin REST aliases for the 6 ops superpowers.
 * Delegates to the same command handlers / parsers as /v1/command — no parallel logic.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseBankStatementText } from "../lib/bank-parsers.js";
import type { Actor, CommandContext } from "../platform/command.js";
import { commandHandlers } from "./registry.js";

type MakeCtx = (actor: Actor) => {
  ctx: CommandContext;
  flush: () => void;
};

const actorBody = z.object({
  propertyId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  role: z.string().default("gm"),
  tenantId: z.string().uuid().optional(),
});

function toActor(input: z.infer<typeof actorBody>): Actor {
  return {
    propertyId: input.propertyId,
    tenantId: input.tenantId ?? input.propertyId,
    staffId: input.staffId ?? "00000000-0000-4000-8000-0000000000aa",
    role: input.role,
  };
}

async function runNamed(
  command: string,
  input: unknown,
  actor: Actor,
  makeCtx: MakeCtx,
) {
  const fn = commandHandlers.get(command);
  if (!fn) return { ok: false as const, error: `Unknown command ${command}` };
  const { ctx, flush } = makeCtx(actor);
  const result = await fn(input, ctx);
  if (result.ok) flush();
  return result;
}

export function registerOpsRestRoutes(
  app: FastifyInstance,
  makeCtx: MakeCtx,
): void {
  /** SP1 — CFM cash advance: debit till + open procurement_advances */
  app.post<{
    Body: {
      propertyId: string;
      amountBtn: number;
      tillBalanceBtn: number;
      purpose?: string;
      idempotencyKey: string;
      actor?: Partial<z.infer<typeof actorBody>>;
    };
  }>("/v1/fiscal/till/advance", async (req, reply) => {
    const body = z
      .object({
        propertyId: z.string().uuid(),
        amountBtn: z.number().positive(),
        tillBalanceBtn: z.number().nonnegative(),
        purpose: z.string().default("cfm_market"),
        idempotencyKey: z.string().uuid(),
        actor: actorBody.partial().optional(),
      })
      .parse(req.body);
    const actor = toActor({
      propertyId: body.propertyId,
      ...body.actor,
      role: body.actor?.role ?? "gm",
    });
    const result = await runNamed(
      "procurement.issueAdvance",
      {
        propertyId: body.propertyId,
        amountBtn: body.amountBtn,
        tillBalanceBtn: body.tillBalanceBtn,
        purpose: body.purpose,
        idempotencyKey: body.idempotencyKey,
      },
      actor,
      makeCtx,
    );
    if (!result.ok) {
      const status = result.error === "DATABASE_REQUIRED" ? 503 : 400;
      return reply.code(status).send(result);
    }
    return result;
  });

  /** SP1 — reconcile advance: receipts vs float, return change to till */
  app.post<{
    Body: {
      propertyId: string;
      advanceId: string;
      spentBtn: number;
      changeReturnedBtn: number;
      idempotencyKey: string;
    };
  }>("/v1/fiscal/till/reconcile-advance", async (req, reply) => {
    const body = z
      .object({
        propertyId: z.string().uuid(),
        advanceId: z.string().uuid(),
        spentBtn: z.number().nonnegative(),
        changeReturnedBtn: z.number().nonnegative(),
        idempotencyKey: z.string().uuid(),
        actor: actorBody.partial().optional(),
      })
      .parse(req.body);
    const actor = toActor({
      propertyId: body.propertyId,
      ...body.actor,
      role: body.actor?.role ?? "gm",
    });
    const result = await runNamed(
      "procurement.reconcileAdvance",
      {
        propertyId: body.propertyId,
        advanceId: body.advanceId,
        spentBtn: body.spentBtn,
        changeReturnedBtn: body.changeReturnedBtn,
        idempotencyKey: body.idempotencyKey,
      },
      actor,
      makeCtx,
    );
    if (!result.ok) {
      const status = result.error === "DATABASE_REQUIRED" ? 503 : 400;
      return reply.code(status).send(result);
    }
    return result;
  });

  /** SP3 — SC tip pool run (immutable period lock via unique period_ym) */
  app.post<{
    Body: {
      propertyId: string;
      periodYm: string;
      poolBtn: number;
      staff: Array<{ staffId: string; tipPoints: number; daysWorked: number }>;
      idempotencyKey: string;
    };
  }>("/v1/hr/tip-pool/run", async (req, reply) => {
    const body = z
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
        idempotencyKey: z.string().uuid(),
        actor: actorBody.partial().optional(),
      })
      .parse(req.body);
    const actor = toActor({
      propertyId: body.propertyId,
      ...body.actor,
      role: body.actor?.role ?? "gm",
    });
    const result = await runNamed(
      "hr.runScTipPool",
      {
        propertyId: body.propertyId,
        periodYm: body.periodYm,
        poolBtn: body.poolBtn,
        staff: body.staff,
        idempotencyKey: body.idempotencyKey,
      },
      actor,
      makeCtx,
    );
    if (!result.ok) {
      const status = result.error === "DATABASE_REQUIRED" ? 503 : 400;
      return reply.code(status).send(result);
    }
    return result;
  });

  /**
   * SP6 — bank CSV/text upload: parse BoB/BNB/DrukPNB then import lines.
   * Multipart is accepted as raw text body (desk reads File → text).
   */
  app.post<{
    Body: {
      propertyId: string;
      bankCode: "bob" | "bnb" | "drukpnb";
      text: string;
      accountLabel?: string;
      statementDate?: string;
      sourceFilename?: string;
      idempotencyKey: string;
    };
  }>("/v1/finance/bank-recon/upload", async (req, reply) => {
    const body = z
      .object({
        propertyId: z.string().uuid(),
        bankCode: z.enum(["bob", "bnb", "drukpnb"]),
        text: z.string().min(1).max(500_000),
        accountLabel: z.string().optional(),
        statementDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        sourceFilename: z.string().optional(),
        idempotencyKey: z.string().uuid(),
        actor: actorBody.partial().optional(),
      })
      .parse(req.body);

    const parsed = parseBankStatementText(body.bankCode, body.text);
    if (parsed.lines.length === 0) {
      return reply.code(400).send({
        ok: false,
        error: "NO_PARSEABLE_LINES",
        data: { warnings: parsed.warnings },
      });
    }

    const actor = toActor({
      propertyId: body.propertyId,
      ...body.actor,
      role: body.actor?.role ?? "gm",
    });
    const statementDate =
      body.statementDate ??
      parsed.lines[0]?.txnDate ??
      new Date().toISOString().slice(0, 10);

    const result = await runNamed(
      "finance.importBankStatement",
      {
        propertyId: body.propertyId,
        bankCode: body.bankCode,
        accountLabel: body.accountLabel ?? `${body.bankCode.toUpperCase()} import`,
        statementDate,
        sourceFilename: body.sourceFilename,
        lines: parsed.lines.map((l) => ({
          txnDate: l.txnDate,
          description: l.description,
          amountBtn: l.amountBtn,
          direction: l.direction,
          externalRef: l.externalRef,
        })),
        idempotencyKey: body.idempotencyKey,
      },
      actor,
      makeCtx,
    );
    if (!result.ok) {
      const status = result.error === "DATABASE_REQUIRED" ? 503 : 400;
      return reply.code(status).send({
        ok: false,
        error: result.error,
        data: {
          warnings: parsed.warnings,
          parsedCount: parsed.lines.length,
        },
      });
    }
    const imported =
      result.data && typeof result.data === "object"
        ? (result.data as Record<string, unknown>)
        : {};
    return {
      ok: true,
      data: {
        ...imported,
        warnings: parsed.warnings,
        parsedCount: parsed.lines.length,
      },
    };
  });
}
