"use client";

import {
  submitPaymentLinkProof,
  type ErpFolioOpsState,
} from "@/app/actions/erp-folio-ops";
import { CloudinaryDocField } from "@/components/erp/CloudinaryDocField";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryOriginalUrl } from "@/lib/cloudinary";
import { useActionState, useState } from "react";

const initial: ErpFolioOpsState = { ok: false };

export function PayProofUploadForm({
  token,
  neftHint,
}: {
  token: string;
  neftHint?: string;
}) {
  const [state, action, pending] = useActionState(submitPaymentLinkProof, initial);
  useActionToast(state, { successMessage: "Proof submitted" });
  const [proofUrl, setProofUrl] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [intent, setIntent] = useState<"camera" | "file">("camera");

  if (state.ok) {
    return (
      <div className="mt-6 border border-espresso/10 bg-white px-6 py-6" role="status">
        <p className="font-medium text-espresso">Screenshot received</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The desk will confirm when your transfer lands (usually 2–3 business days).
          Quote your booking reference in bank remarks.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4 border border-espresso/10 bg-white px-6 py-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Upload payment proof
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pay via bank QR, GPay, or NEFT using the accounts above, then upload your
          transaction screenshot.
        </p>
        {neftHint ? (
          <p className="mt-2 text-sm text-espresso">{neftHint}</p>
        ) : null}
      </div>
      <input type="hidden" name="token" value={token} />
      <CloudinaryDocField
        name="proof_url"
        value={proofUrl}
        onPick={(pickIntent) => {
          setIntent(pickIntent);
          setPickerOpen(true);
        }}
        onClear={() => setProofUrl("")}
      />
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Payment screenshot"
        uploadFolder="pelbu/payments"
        initialTab="upload"
        uploadIntent={intent}
        acceptVideo={false}
        onSelect={(publicId) => {
          setProofUrl(cloudinaryOriginalUrl(publicId) ?? publicId);
          setPickerOpen(false);
        }}
      />
      <div className="space-y-1.5">
        <Label htmlFor="proof_reference" className="text-xs text-muted-foreground">
          Bank reference (optional)
        </Label>
        <Input id="proof_reference" name="proof_reference" placeholder="Txn ID from slip" />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button
        type="submit"
        disabled={pending || !proofUrl}
        className="min-h-11 w-full bg-espresso text-ivory hover:bg-espresso/90"
      >
        {pending ? "Uploading…" : "Submit proof → pending bank"}
      </Button>
    </form>
  );
}
