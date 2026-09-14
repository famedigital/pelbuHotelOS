"use client";

import {
  upsertStaffModuleAccess,
  type HrActionState,
} from "@/app/actions/erp-hr";
import { StaffAccessGrantPicker } from "@/components/erp/StaffAccessGrantPicker";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  defaultModulesForDeskRole,
  expandGrantsForEditor,
  summarizeDeskGrants,
} from "@/lib/erp/desk-modules";
import type { DeskRole } from "@/lib/desk-auth";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

export type ModuleAccessStaffRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  deskRole: string | null;
  /** null = role defaults; may mix module keys + tab hrefs */
  deskModuleKeys: string[] | null;
  /** Cannot strip owner */
  isOwner: boolean;
};

const initial: HrActionState = { ok: false };

function seedSelection(
  staff: ModuleAccessStaffRow,
  roleDefaults: string[],
): Set<string> {
  const expanded = expandGrantsForEditor(staff.deskModuleKeys, roleDefaults);
  return expanded.selected;
}

function RowForm({
  staff,
  canEdit,
}: {
  staff: ModuleAccessStaffRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const role = (staff.deskRole as DeskRole | null) ?? "front_desk";
  const roleDefaults = useMemo(
    () => defaultModulesForDeskRole(staff.isOwner ? "owner" : role),
    [staff.isOwner, role],
  );
  const [useDefaults, setUseDefaults] = useState(staff.deskModuleKeys == null);
  const [selected, setSelected] = useState<Set<string>>(() =>
    seedSelection(staff, roleDefaults),
  );
  const [state, action, pending] = useActionState(
    upsertStaffModuleAccess,
    initial,
  );
  useActionToast(state, { successMessage: "Module access saved" });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const summary = summarizeDeskGrants(
    staff.deskModuleKeys,
    staff.isOwner ? "owner" : role,
    { isOwner: staff.isOwner },
  );

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm md:p-5"
    >
      <input type="hidden" name="staff_id" value={staff.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold tracking-tight">
            {staff.fullName}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{staff.employeeCode}</span>
            {" · "}
            {(staff.deskRole ?? "—").replaceAll("_", " ")}
            {staff.isOwner ? " · owner (always full)" : ""}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
        </div>
        {canEdit && !staff.isOwner ? (
          <Button
            type="submit"
            variant="citrus"
            className="min-h-10"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save access"}
          </Button>
        ) : null}
      </div>

      {staff.isOwner ? (
        <p className="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
          Owner accounts always receive every module and screen.
        </p>
      ) : (
        <StaffAccessGrantPicker
          useDefaults={useDefaults}
          onUseDefaultsChange={(next) => {
            setUseDefaults(next);
            if (next) setSelected(seedSelection({ ...staff, deskModuleKeys: null }, roleDefaults));
            else if (staff.deskModuleKeys == null) {
              setSelected(seedSelection({ ...staff, deskModuleKeys: null }, roleDefaults));
            }
          }}
          selected={selected}
          onSelectedChange={setSelected}
          roleDefaults={roleDefaults}
          disabled={!canEdit}
        />
      )}

      {state.error ? (
        <p className="text-sm text-destructive" role="status">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-citrus" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function StaffModuleAccessMatrix({
  staff,
  canEdit,
}: {
  staff: ModuleAccessStaffRow[];
  canEdit: boolean;
}) {
  if (staff.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No desk-capable staff yet. Turn on &quot;Allow hotel desk&quot; on a
        person&apos;s Access tab first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {staff.map((row) => (
        <RowForm key={row.id} staff={row} canEdit={canEdit} />
      ))}
    </div>
  );
}
