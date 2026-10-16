"use client";

import {
  uploadAgentPaymentProof,
  type AgentPortalState,
} from "@/app/actions/agent-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/cloudinary-direct-upload";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";

const initial: AgentPortalState = { ok: false };

export function AgentPaymentProofUpload({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    uploadAgentPaymentProof,
    initial,
  );
  useActionToast(state, { successMessage: "Payment proof sent to the desk" });
  const [uploading, startUpload] = useTransition();
  const [docUrl, setDocUrl] = useState("");
  const [docName, setDocName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File | null) {
    if (!file) return;
    setLocalError(null);
    startUpload(async () => {
      try {
        const result = await uploadToCloudinary(file, {
          folder: "pelbu/agent-payment-proofs",
          signEndpoint: "/api/agents/cloudinary/sign-upload",
          allowPdf: true,
        });
        const url =
          (result as { secureUrl?: string }).secureUrl ||
          cloudinaryUrl(result.publicId, {
            resourceType: result.resourceType,
          });
        setDocUrl(url);
        setDocName(file.name.slice(0, 140));
      } catch (e) {
        setLocalError(
          e instanceof Error ? e.message : "Upload failed — try again.",
        );
      }
    });
  }

  return (
    <div
      id="payment-proof"
      className="scroll-mt-24 space-y-3 rounded-2xl border border-border/80 bg-card p-4"
    >
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-sky-700 uppercase">
          Payment proof
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a bank transfer / QR screenshot. The desk matches it — this does
          not auto-post money.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          {uploading ? "Uploading…" : "Choose screenshot"}
        </Button>
      </div>

      {localError ? (
        <p className="text-sm text-destructive">{localError}</p>
      ) : null}

      <form action={action} className="space-y-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        <div className="space-y-1.5">
          <Label htmlFor="proof-url">File URL</Label>
          <Input
            id="proof-url"
            name="doc_url"
            type="url"
            required
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="Upload above, or paste https://…"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="proof-name">Label</Label>
            <Input
              id="proof-name"
              name="doc_name"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. BOB transfer 17 Oct"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proof-notes">Note</Label>
            <Input
              id="proof-notes"
              name="notes"
              placeholder="Optional ref / amount"
            />
          </div>
        </div>
        {docUrl ? (
          <p className="truncate text-xs text-muted-foreground">
            Ready:{" "}
            <a
              href={docUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-800 underline"
            >
              preview
            </a>
          </p>
        ) : null}
        <Button
          type="submit"
          size="sm"
          className="h-9"
          disabled={pending || !docUrl}
        >
          {pending ? "Saving…" : "Submit to desk"}
        </Button>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
      </form>
    </div>
  );
}
