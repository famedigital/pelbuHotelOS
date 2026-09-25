"use client";

import { createHkAssignment, type OpsState } from "@/app/actions/erp-p9-ops";
import { HkChecklistForm } from "@/components/erp/HkLostFoundForms";
import { HkStaffAssignForm } from "@/components/erp/HkStaffAssignForm";
import { HkStatusForm } from "@/components/erp/P9OpsForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import {
  HK_CHIP_ORDER,
  HK_FILTER_LABEL,
  rowMatchesFilter,
  type HkBoardRow,
  type HkFilterKey,
} from "@/lib/hk/board";
import { useMemo, useState } from "react";
import { useActionState } from "react";

const initial: OpsState = { ok: false };

export type { HkBoardRow };

export function HousekeepingBoard({
  rows,
  units,
  staff,
  today,
}: {
  rows: HkBoardRow[];
  units: { id: string; label: string }[];
  staff: { id: string; full_name: string }[];
  today: string;
}) {
  const [filter, setFilter] = useState<HkFilterKey>("open");
  const [query, setQuery] = useState("");
  const [state, action, pending] = useActionState(createHkAssignment, initial);
  usePendingFeedback(pending, "Creating assignment…");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!rowMatchesFilter(row, filter)) return false;
      if (!q) return true;
      const haystack = [
        row.roomLabel,
        row.guestName ?? "",
        row.mealPlan ?? "",
        row.staffName ?? "",
        row.notes ?? "",
        row.status,
        ...row.categories.map((category) => HK_FILTER_LABEL[category]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query, rows]);

  const openCount = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, "open")).length,
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {HK_CHIP_ORDER.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "secondary" : "outline"}
            onClick={() => setFilter(key)}
          >
            {HK_FILTER_LABEL[key]}
            {key === "open" && openCount > 0 ? ` (${openCount})` : ""}
          </Button>
        ))}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search room, staff, notes…"
          className="ml-auto max-w-xs"
          aria-label="Search housekeeping assignments"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Checklist</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/20">
              <TableCell colSpan={7}>
                <form action={action} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="business_date" value={today} />
                  <select
                    name="room_unit_id"
                    required
                    className="h-9 min-w-[120px] flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Add room…
                    </option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <select
                    name="staff_id"
                    className="h-9 min-w-[140px] flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                    defaultValue=""
                  >
                    <option value="">Unassigned</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                  <Input
                    name="notes"
                    placeholder="Notes"
                    className="h-9 min-w-[160px] flex-[2]"
                  />
                  <Button type="submit" size="sm" disabled={pending} className="h-9">
                    {pending ? "Adding…" : "Add"}
                  </Button>
                  {state.error ? (
                    <p className="w-full text-xs text-destructive">{state.error}</p>
                  ) : null}
                  {state.message ? (
                    <p className="w-full text-xs text-muted-foreground">
                      {state.message}
                    </p>
                  ) : null}
                </form>
              </TableCell>
            </TableRow>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {filter === "open"
                    ? "No open housekeeping work right now."
                    : "No assignments match this filter."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="font-medium">
                    <div>
                      <p>{row.roomLabel}</p>
                      {row.guestName ? (
                        <p className="text-xs text-muted-foreground">
                          {row.guestName}
                          {row.mealPlan ? ` · ${row.mealPlan}` : ""}
                          {row.pax != null ? ` · ${row.pax}p` : ""}
                          {(row.openLaundry ?? 0) > 0
                            ? ` · laundry ${row.openLaundry}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.categories.length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.categories.map((category) => (
                          <span
                            key={category}
                            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            {HK_FILTER_LABEL[category]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isPending ? (
                      <PendingAssignForm
                        roomUnitId={row.roomUnitId}
                        staff={staff}
                        today={today}
                      />
                    ) : (
                      <HkStaffAssignForm
                        assignmentId={row.id}
                        staffId={row.staffId}
                        staff={staff}
                        status={row.status}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                    {row.notes ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.isPending ? (
                      <span className="text-xs text-muted-foreground">
                        Assign first
                      </span>
                    ) : (
                      <HkChecklistForm
                        id={row.id}
                        cleanOk={row.cleanOk}
                        linenOk={row.linenOk}
                        amenitiesOk={row.amenitiesOk}
                        status={row.status}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isPending ? null : (
                      <HkStatusForm id={row.id} status={row.status} />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PendingAssignForm({
  roomUnitId,
  staff,
  today,
}: {
  roomUnitId: string;
  staff: { id: string; full_name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createHkAssignment, initial);
  usePendingFeedback(pending, "Creating assignment…");

  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="business_date" value={today} />
      <input type="hidden" name="room_unit_id" value={roomUnitId} />
      <select
        name="staff_id"
        className="h-8 min-w-[120px] rounded-md border border-input bg-transparent px-2 text-xs"
        defaultValue=""
      >
        <option value="">Unassigned</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.full_name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" className="h-8 px-2" disabled={pending}>
        {pending ? "…" : "Assign"}
      </Button>
      {state.error ? (
        <p className="w-full text-[10px] text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : status === "open" ||
          status === "in_progress" ||
          status === "needs_assignment"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  const label =
    status === "needs_assignment"
      ? "needs assign"
      : status.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}
