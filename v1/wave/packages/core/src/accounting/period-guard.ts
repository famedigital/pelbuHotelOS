import { writeAuditEvent } from "../audit.ts";
import { coreRuntime } from "../runtime.ts";
import type { Admin } from "../admin.ts";
import type { AccountingPeriod } from "./types.ts";
import { resolvePeriodForDate } from "./journals.ts";

export type PeriodGuardOptions = {
  propertyId: string;
  managerPin?: string | null;
  overrideReason?: string | null;
  actor?: string;
};

function todayIso(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function lockedMessage(period: AccountingPeriod): string {
  if (period.status === "soft_closed") {
    return `Period ${period.label} is soft-closed. Reopen the period or use a manager override (PIN + reason).`;
  }
  return `Period ${period.label} is closed. Manager override (PIN + reason) is required to post.`;
}

/**
 * Ensures an accounting period exists and accepts money writes for the given date.
 * Open periods pass; soft-closed/closed require manager PIN + reason with audit.
 */
export async function assertOpenPeriodForDate(
  admin: Admin,
  propertyId: string,
  businessDate: string | null | undefined,
  options?: PeriodGuardOptions,
): Promise<AccountingPeriod> {
  const journalDate = todayIso(businessDate);
  const period = await resolvePeriodForDate(admin, propertyId, journalDate);
  if (!period) {
    throw new Error(
      `No accounting period covers ${journalDate}. Open a period before posting.`,
    );
  }
  if (period.status === "open") return period;

  const pin = options?.managerPin?.trim();
  const reason = options?.overrideReason?.trim();
  const verifier = coreRuntime().verifyManagerPin;
  if (pin && reason && !verifier) {
    throw new Error(
      `${lockedMessage(period)} Manager PIN override is not available on this server (no PIN verifier registered).`,
    );
  }
  const verified =
    pin && reason && verifier ? await verifier(admin, propertyId, pin) : null;
  if (verified?.ok) {
    await writeAuditEvent(admin, {
      propertyId,
      action: "accounting.period.override_post",
      entityType: "accounting_periods",
      entityId: period.id,
      summary: `Manager override post into ${period.status} period ${period.label}`,
      meta: {
        journalDate,
        periodStatus: period.status,
        reason,
      },
      actor: options?.actor ?? "desk",
    });
    return period;
  }

  throw new Error(lockedMessage(period));
}
