"use client";

import {
  correctInHouseStay,
  loadInHouseCorrectForm,
  type InHouseCorrectForm,
} from "@/app/actions/erp-inhouse-correct";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState, useState } from "react";

export function InHouseCorrectButton({
  bookingId,
  guestName,
}: {
  bookingId: string;
  guestName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InHouseCorrectForm | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(correctInHouseStay, {
    ok: false,
  });

  async function openForm() {
    setOpen(true);
    setError(null);
    const result = await loadInHouseCorrectForm(bookingId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(result.form);
    const next: Record<string, string> = {};
    for (const row of result.form.assignments) next[row.id] = row.roomUnitId;
    setPicks(next);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium"
        onClick={(event) => {
          event.stopPropagation();
          void openForm();
        }}
      >
        Correct
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setOpen(false)}
        >
          <form
            action={action}
            className="max-h-[100dvh] w-full space-y-3 overflow-y-auto bg-background p-4 md:max-w-md md:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                Correct {guestName || "stay"}
              </h2>
              <button type="button" className="text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <input type="hidden" name="booking_id" value={bookingId} />
            <input
              type="hidden"
              name="rooms_json"
              value={JSON.stringify(
                Object.entries(picks).map(([assignmentId, roomUnitId]) => ({
                  assignmentId,
                  roomUnitId,
                })),
              )}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="space-y-1">
              <Label htmlFor={`name-${bookingId}`}>Name</Label>
              <Input
                id={`name-${bookingId}`}
                name="contact_name"
                defaultValue={form?.contactName ?? guestName ?? ""}
                required
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`phone-${bookingId}`}>Phone</Label>
              <Input
                id={`phone-${bookingId}`}
                name="contact_phone"
                defaultValue={form?.contactPhone ?? ""}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`notes-${bookingId}`}>Notes</Label>
              <Input
                id={`notes-${bookingId}`}
                name="notes"
                defaultValue={form?.notes ?? ""}
                className="h-11 text-base"
              />
            </div>
            {(form?.assignments ?? []).map((row) => (
              <div key={row.id} className="space-y-1">
                <Label>Room {row.label}</Label>
                <select
                  className="h-11 w-full rounded-md border bg-background px-2 text-base"
                  value={picks[row.id] ?? row.roomUnitId}
                  onChange={(event) =>
                    setPicks((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))
                  }
                >
                  {(form?.rooms ?? []).map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.roomTypeName} {room.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor={`pin-${bookingId}`}>Manager PIN</Label>
              <Input
                id={`pin-${bookingId}`}
                name="manager_pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 text-base"
                placeholder="Once per session"
              />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : state.ok && state.message ? (
              <p className="text-sm">{state.message}</p>
            ) : null}
            <Button type="submit" disabled={pending} className="h-11 w-full">
              {pending ? "Saving…" : "Save correction"}
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
