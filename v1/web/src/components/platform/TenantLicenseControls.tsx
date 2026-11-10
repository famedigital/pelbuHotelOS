"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createSaasBypassToken,
  upsertTenantLicense,
} from "@/app/actions/platform-admin";

export function TenantLicenseControls({
  propertyId,
  tier,
  status,
  paidThrough,
}: {
  propertyId: string;
  tier: string;
  status: string;
  paidThrough: string | null;
}) {
  const [pending, start] = useTransition();
  const [bypass, setBypass] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        action={(fd) => {
          start(async () => {
            try {
              await upsertTenantLicense(fd);
              toast.success("Licence updated");
            } catch (err) {
              console.error(err);
              toast.error(err instanceof Error ? err.message : String(err));
            }
          });
        }}
      >
        <input type="hidden" name="property_id" value={propertyId} />
        <select
          name="tier"
          defaultValue={tier}
          className="rounded-md border px-2 py-1 text-xs"
        >
          <option value="boutique">boutique</option>
          <option value="professional">professional</option>
          <option value="resort">resort</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-2 py-1 text-xs"
        >
          <option value="active">active</option>
          <option value="grace">grace</option>
          <option value="soft_lock">soft_lock</option>
          <option value="hard_lock">hard_lock</option>
        </select>
        <input
          type="date"
          name="paid_through"
          defaultValue={paidThrough ?? ""}
          className="rounded-md border px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        >
          Save
        </button>
      </form>
      <button
        type="button"
        disabled={pending}
        className="w-fit rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        onClick={() => {
          const fd = new FormData();
          fd.set("property_id", propertyId);
          start(async () => {
            const res = await createSaasBypassToken(fd);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setBypass(`${res.token} · exp ${new Date(res.expiresAt).toLocaleString()}`);
            toast.success(`Bypass ${res.token}`);
          });
        }}
      >
        48h bypass
      </button>
      {bypass ? (
        <p className="font-mono text-[10px] text-amber-700 dark:text-amber-400">{bypass}</p>
      ) : null}
    </div>
  );
}
