"use client";

import {
  approveRateRequest,
  rejectRateRequest,
  type RateApprovalActionState,
} from "@/app/actions/erp-rate-approvals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: RateApprovalActionState = { ok: false };

export function RateApproveForm({
  bookingId,
  bookingRoomId,
}: {
  bookingId: string;
  bookingRoomId: string;
}) {
  const [state, action, pending] = useActionState(approveRateRequest, initial);
  useActionToast(state, { successMessage: state.message ?? "Approved" });
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="booking_room_id" value={bookingRoomId} />
      <Input
        name="note"
        placeholder="Note (optional)"
        className="h-8 min-w-[8rem] flex-1 text-xs"
      />
      <Button
        type="submit"
        variant="citrus"
        className="h-8 px-3 text-xs"
        disabled={pending}
      >
        {pending ? "…" : "Approve"}
      </Button>
    </form>
  );
}

export function RateRejectForm({
  bookingId,
  bookingRoomId,
}: {
  bookingId: string;
  bookingRoomId: string;
}) {
  const [state, action, pending] = useActionState(rejectRateRequest, initial);
  useActionToast(state, { successMessage: state.message ?? "Rejected" });
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="booking_room_id" value={bookingRoomId} />
      <Input
        name="note"
        placeholder="Reason"
        className="h-8 min-w-[8rem] flex-1 text-xs"
        required
      />
      <Button
        type="submit"
        variant="outline"
        className="h-8 px-3 text-xs"
        disabled={pending}
      >
        {pending ? "…" : "Reject"}
      </Button>
    </form>
  );
}
