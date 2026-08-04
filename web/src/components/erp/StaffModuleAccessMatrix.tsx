"use client";

import {
  upsertStaffModuleAccess,
  type HrActionState,
} from "@/app/actions/erp-hr";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  DESK_MODULE_CATALOG,
  defaultModulesForDeskRole,
} from "@/lib/erp/desk-modules";
import type { DeskRole } from "@/lib/desk-auth";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

export type ModuleAccessStaffRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  deskRole: string | null;
  /** null = role defaults */
  deskModuleKeys: string[] | null;
  /** Cannot strip owner */
  isOwner: boolean;
};

const initial: HrActionState = { ok: false };

function RowForm({
  staff,
  canEdit,
}: {
  staff: ModuleAccessStaffRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const role = (staff.deskRole as DeskRole | null) ?? "front_desk";
  const defaults = defaultModulesForDeskRole(
    staff.isOwner ? "owner" : role,
  );
  const [useDefaults, setUseDefaults] = useState(staff.deskModuleKeys == null);
  const [keys, setKeys] = useState<string[]>(
    staff.deskModuleKeys ?? defaults,
  );
  const [state, action, pending] = useActionState(
    upsertStaffModuleAccess,
    initial,
  );
  useActionToast(state, { successMessage: "Module access saved" });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  function toggleKey(key: string) {
    if (key === "dashboard") return;
    setKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <input type="hidden" name="staff_id" value={staff.id} />
      <input
        type="hidden"
        name="module_mode"
        value={useDefaults ? "defaults" : "custom"}
      />
      {!useDefaults
        ? keys.map((k) => (
            <input key={k} type="hidden" name="module_key" value={k} />
          ))
        : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{staff.fullName}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{staff.employeeCode}</span>
            {" · "}
            {(staff.deskRole ?? "—").replaceAll("_", " ")}
            {staff.deskModuleKeys == null ? " · role defaults" : " · custom"}
            {staff.isOwner ? " · owner (always full)" : ""}
          </p>
        </div>
        {canEdit && !staff.isOwner ? (
          <Button
            type="submit"
            variant="citrus"
            className="min-h-10"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>

      {staff.isOwner ? (
        <p className="text-xs text-muted-foreground">
          Owner accounts always receive every module.
        </p>
      ) : (
        <>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useDefaults}
              disabled={!canEdit}
              onChange={(e) => {
                setUseDefaults(e.target.checked);
                if (e.target.checked) setKeys(defaults);
              }}
              className="size-4 rounded border"
            />
            <span>Use role defaults ({defaults.join(", ")})</span>
          </label>

          <div
            className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${
              useDefaults ? "opacity-50" : ""
            }`}
          >
            {DESK_MODULE_CATALOG.map((mod) => {
              const checked = useDefaults
                ? defaults.includes(mod.key)
                : keys.includes(mod.key);
              const locked = mod.key === "dashboard" || useDefaults;
              return (
                <label
                  key={mod.key}
                  className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canEdit || locked || useDefaults}
                    onChange={() => toggleKey(mod.key)}
                    className="size-4 rounded border"
                  />
                  <span>{mod.title}</span>
                </label>
              );
            })}
          </div>
        </>
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
