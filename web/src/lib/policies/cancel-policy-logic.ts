/** Pure cancel/no-show policy helpers — safe for unit tests (no server-only). */

export type CancelPolicyInputs = {
  isMouAgent: boolean;
  freeCancelDays: number;
  daysUntilCheckIn: number;
  mouFreeCancel: boolean;
  mouWaiveNoShow: boolean;
};

export function computeCancelWaivers(input: CancelPolicyInputs): {
  waiveCancelFee: boolean;
  waiveNoShowFee: boolean;
} {
  const waiveCancelFee =
    input.isMouAgent && input.mouFreeCancel
      ? true
      : input.daysUntilCheckIn >= input.freeCancelDays;

  const waiveNoShowFee = input.isMouAgent && input.mouWaiveNoShow;

  return { waiveCancelFee, waiveNoShowFee };
}

export function daysUntilCheckIn(checkInIso: string, fromDate = new Date()): number {
  const checkIn = new Date(`${checkInIso}T00:00:00`);
  const from = new Date(`${fromDate.toISOString().slice(0, 10)}T00:00:00`);
  if (Number.isNaN(checkIn.getTime())) return 0;
  return Math.floor((checkIn.getTime() - from.getTime()) / 86_400_000);
}

export function isMouAgentFromBooking(
  bookedByRole: string | null | undefined,
  agentWantsMou: boolean,
): boolean {
  return bookedByRole === "mou_agent" || agentWantsMou;
}
