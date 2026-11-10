import { roleAllows, type PermissionKey } from "@hos-v2/domain";
import { z } from "zod";

export type Actor = {
  staffId: string;
  role: string;
  propertyId: string;
  tenantId: string;
};

export type CommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export type OutboxEvent = {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export type CommandContext = {
  actor: Actor;
  /** Collect events to write in the same DB transaction as the command. */
  emit: (event: OutboxEvent) => void;
  audit: (entry: {
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
  }) => void;
};

export function assertPermission(
  actor: Actor,
  key: PermissionKey,
): CommandResult<never> | null {
  if (!roleAllows(actor.role, key)) {
    return { ok: false, error: `Forbidden: ${key}`, code: "FORBIDDEN" };
  }
  return null;
}

export function assertProperty(
  actor: Actor,
  propertyId: string,
): CommandResult<never> | null {
  if (actor.propertyId !== propertyId) {
    return { ok: false, error: "property_id mismatch", code: "TENANT" };
  }
  return null;
}

export const idempotencyKeySchema = z.string().uuid();

export type OutboxRecord = OutboxEvent & {
  id: string;
  propertyId: string;
  /** Monotonic cursor for live poll / SSE resume. */
  seq: number;
  at: string;
};

type OutboxListener = (event: OutboxRecord) => void;

/** In-memory outbox buffer used until DB adapter is wired (Phase 2 worker). */
export class MemoryOutbox {
  readonly events: OutboxRecord[] = [];
  readonly receipts = new Set<string>();
  private seq = 0;
  private readonly listeners = new Set<OutboxListener>();

  push(propertyId: string, event: OutboxEvent): string {
    const id = crypto.randomUUID();
    this.seq += 1;
    const record: OutboxRecord = {
      ...event,
      id,
      propertyId,
      seq: this.seq,
      at: new Date().toISOString(),
    };
    this.events.push(record);
    /* Cap memory — keep last 2k events for live cursors. */
    if (this.events.length > 2_000) {
      this.events.splice(0, this.events.length - 2_000);
    }
    for (const fn of this.listeners) {
      try {
        fn(record);
      } catch (err) {
        console.error("[outbox] listener failed", err);
      }
    }
    return id;
  }

  subscribe(fn: OutboxListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  since(opts: {
    propertyId?: string;
    afterSeq?: number;
    limit?: number;
  }): OutboxRecord[] {
    const after = opts.afterSeq ?? 0;
    const limit = opts.limit ?? 100;
    const out: OutboxRecord[] = [];
    for (let i = this.events.length - 1; i >= 0; i -= 1) {
      const ev = this.events[i]!;
      if (ev.seq <= after) break;
      if (opts.propertyId && ev.propertyId !== opts.propertyId) continue;
      out.push(ev);
      if (out.length >= limit) break;
    }
    return out.reverse();
  }

  /** Idempotent handler: process each event id + handlerKey once. */
  async processOnce(
    handlerKey: string,
    handler: (event: OutboxRecord) => Promise<void>,
  ): Promise<number> {
    let n = 0;
    for (const event of this.events) {
      const key = `${event.id}:${handlerKey}`;
      if (this.receipts.has(key)) continue;
      await handler(event);
      this.receipts.add(key);
      n += 1;
    }
    return n;
  }
}

export const globalOutbox = new MemoryOutbox();
