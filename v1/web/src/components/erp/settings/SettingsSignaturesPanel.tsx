"use client";

import { uploadAuthorizedSignature, uploadStaffSignature } from "@/app/actions/staff-signature";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";

export type SignatureStaffRow = {
  id: string;
  fullName: string;
  deskRole: string | null;
  accessLevel: string | null;
  hasSignature: boolean;
};

function isAdmin(row: SignatureStaffRow): boolean {
  const role = (row.deskRole ?? "").toLowerCase();
  const access = (row.accessLevel ?? "").toLowerCase();
  return role === "owner" || role === "gm" || access === "owner" || access === "admin";
}

export function SettingsSignaturesPanel({
  staff,
  signatoryName,
}: {
  staff: SignatureStaffRow[];
  signatoryName: string;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">Bill signatures</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each desk user uploads the signature that prints on “Bill prepared by”.
          Admins must upload one. The authorized signatory on the master bill is separate.
        </p>
      </div>
      <ul className="space-y-3">
        {staff.map((row) => (
          <li key={row.id} className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
            <div>
              <p className="font-medium">{row.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {row.hasSignature ? "Signature saved" : "No signature yet"}
                {isAdmin(row) && !row.hasSignature ? " · Required for admin" : ""}
              </p>
            </div>
            <StaffSignatureForm staffId={row.id} />
          </li>
        ))}
      </ul>
      <AuthorizedForm initialName={signatoryName} />
    </section>
  );
}

function StaffSignatureForm({ staffId }: { staffId: string }) {
  const [state, action, pending] = useActionState(uploadStaffSignature, { ok: false });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="staff_id" value={staffId} />
      <input name="signature" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" required />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Upload"}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state.ok ? <span className="text-xs text-muted-foreground">Saved</span> : null}
    </form>
  );
}

function AuthorizedForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(uploadAuthorizedSignature, { ok: false });
  return (
    <form action={action} className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium">Authorized signatory</p>
      <p className="text-xs text-muted-foreground">
        Prints on every bill. Leave the file empty to keep the current sign. Until a scan is uploaded, the name is written as a signature.
      </p>
      <label className="block text-sm">
        Name
        <input
          name="name"
          defaultValue={initialName}
          className="mt-1 w-full max-w-xs rounded-md border px-3 py-2"
        />
      </label>
      <input name="signature" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save signatory"}
      </Button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-muted-foreground">Saved</p> : null}
    </form>
  );
}
