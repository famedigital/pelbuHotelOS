"use client";

import {
  emailBookingSettlementPack,
  saveGuideSignPhoto,
  sealBookingSettlementPack,
  waiveGuideSign,
  type EmailPackState,
  type GuideSignState,
  type SealPackState,
  type SettlementPrintPack,
} from "@/app/actions/erp-settlement-pack";
import {
  AgentSettlementPrintSheet,
  printAgentSettlementSheet,
} from "@/components/erp/AgentSettlementPrintSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/cloudinary-direct-upload";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  CameraIcon,
  ExpandIcon,
  FileUpIcon,
  Loader2Icon,
  MailIcon,
  PrinterIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

const initialGuide: GuideSignState = { ok: false };
const initialSeal: SealPackState = { ok: false };
const initialEmail: EmailPackState = { ok: false };

export type GuideEvidencePanelProps = {
  bookingId: string;
  guestName: string;
  rooms: string[];
  checkIn: string;
  checkOut: string;
  guideNumber: string | null;
  agentName: string | null;
  agentEmail: string | null;
  needsEvidence: boolean;
  guideSignStatus: string | null;
  guideSignPhotoPublicId: string | null;
  canLeave: boolean;
  packs: Array<{
    id: string;
    sealedAt: string;
    emailSentAt: string | null;
    emailTo: string | null;
  }>;
  confirmationCode?: string | null;
  /** Live print pack (logo, amounts, lines) from fetchBookingSettlementEvidence */
  printPack?: SettlementPrintPack | null;
  onChanged?: () => void;
};

/**
 * Print pack → guide ink → camera | scanner | PC file → guests leave.
 * Seal + email = FO after leave (not a leave gate).
 */
export function GuideEvidencePanel({
  bookingId,
  guestName,
  rooms,
  checkIn,
  checkOut,
  guideNumber,
  agentName,
  agentEmail,
  needsEvidence,
  guideSignStatus,
  guideSignPhotoPublicId,
  canLeave,
  packs,
  confirmationCode = null,
  printPack = null,
  onChanged,
}: GuideEvidencePanelProps) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [emailTo, setEmailTo] = useState(agentEmail ?? "");
  const [packLightboxOpen, setPackLightboxOpen] = useState(false);

  const [photoState, photoAction, photoPending] = useActionState(
    saveGuideSignPhoto,
    initialGuide,
  );
  const [waiveState, waiveAction, waivePending] = useActionState(
    waiveGuideSign,
    initialGuide,
  );
  const [sealState, sealAction, sealPending] = useActionState(
    sealBookingSettlementPack,
    initialSeal,
  );
  const [emailState, emailAction, emailPending] = useActionState(
    emailBookingSettlementPack,
    initialEmail,
  );

  useActionToast(photoState, {
    successMessage: photoState.message ?? "Evidence saved",
  });
  useActionToast(waiveState, {
    successMessage: waiveState.message ?? "Waived",
  });
  useActionToast(sealState, {
    successMessage: sealState.message ?? "Sealed",
  });
  useActionToast(emailState, {
    successMessage: emailState.message ?? "Emailed",
  });

  useEffect(() => {
    if (photoState.ok || waiveState.ok || sealState.ok || emailState.ok) {
      onChanged?.();
      router.refresh();
    }
  }, [photoState.ok, waiveState.ok, sealState.ok, emailState.ok, onChanged, router]);

  useEffect(() => {
    setEmailTo(agentEmail ?? "");
  }, [agentEmail]);

  if (!needsEvidence) {
    return (
      <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        No agent on this stay — guide settlement pack not required. Guests may
        leave after balance rules.
      </p>
    );
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, {
        folder: `pelbu/stay-evidence/${bookingId}`,
        signEndpoint: "/api/erp/cloudinary/sign-upload",
        imageOnly: false,
        onProgress: (next) => setProgress(next.percent),
      });
      const fd = new FormData();
      fd.set("booking_id", bookingId);
      fd.set("guide_sign_photo_public_id", result.publicId);
      await photoAction(fd);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not upload evidence.",
      );
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const photoOnFile =
    guideSignStatus === "photo" && Boolean(guideSignPhotoPublicId);
  const waived = guideSignStatus === "waived";
  /** Desk strip — tall enough to read handwriting without opening. */
  const previewUrl = guideSignPhotoPublicId
    ? cloudinaryUrl(guideSignPhotoPublicId, {
        width: 900,
        height: 1400,
        crop: "limit",
        quality: "auto:good",
      })
    : null;
  /** Full lightbox — high-res for ink / stamp review. */
  const fullUrl = guideSignPhotoPublicId
    ? cloudinaryUrl(guideSignPhotoPublicId, {
        width: 1800,
        height: 2400,
        crop: "limit",
        quality: "auto:best",
      })
    : null;

  const balancePreview =
    printPack != null ? formatGuestBtn(printPack.balanceBtn) : null;
  const agentPreview =
    printPack != null && printPack.agentChargesBtn > 0.009
      ? formatGuestBtn(printPack.agentChargesBtn)
      : null;

  return (
    <div className="space-y-3 rounded-md border bg-card p-3 print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 print:hidden">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Agent settlement evidence
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {agentName ?? "Agent"} · guide {guideNumber?.trim() || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Print branded A4 (logo + amounts) → guide ink → attach scan → leave.
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium",
            canLeave
              ? "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-900 dark:text-amber-200",
          )}
        >
          {canLeave ? "Leave allowed" : "Need guide paper"}
        </span>
      </div>

      <div className="space-y-2 rounded-md border border-dashed bg-background px-3 py-3 print:hidden">
        <p className="text-center text-xs font-semibold tracking-wide uppercase">
          Print preview · settlement pack
        </p>
        <p className="text-sm font-medium">{guestName || "Guest"}</p>
        <p className="text-xs text-muted-foreground">
          {checkIn} → {checkOut}
          {rooms.length ? ` · ${rooms.join(", ")}` : null}
          {agentName ? ` · ${agentName}` : null}
          {guideNumber ? ` · Guide #${guideNumber}` : null}
        </p>
        {balancePreview ? (
          <p className="text-sm font-semibold tabular-nums text-foreground">
            Balance {balancePreview}
            {agentPreview ? ` · Agent AR ${agentPreview}` : null}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Loading amounts… refresh StayHub if still empty
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Print uses hotel letterhead + folio Nu — not this compact strip.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => printAgentSettlementSheet()}
        >
          <PrinterIcon className="size-4" />
          Print pack
        </Button>
      </div>

      <div className="desk-print-host" aria-hidden>
        <AgentSettlementPrintSheet
          pack={printPack}
          fallback={{
            guestName,
            rooms,
            checkIn,
            checkOut,
            guideNumber,
            agentName,
            confirmationCode,
          }}
        />
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void uploadFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.tif,.tiff"
        className="sr-only"
        onChange={(e) => void uploadFile(e.target.files?.[0])}
      />

      <div className="grid gap-2 sm:grid-cols-2 print:hidden">
        <Button
          type="button"
          variant="citrus"
          className="min-h-11"
          disabled={busy || photoPending}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <CameraIcon className="size-4" />
          )}
          Phone camera
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || photoPending}
          onClick={() => fileRef.current?.click()}
        >
          <FileUpIcon className="size-4" />
          Scanner / file
        </Button>
      </div>

      {busy ? (
        <p className="text-xs text-muted-foreground print:hidden">
          Uploading… {progress}%
        </p>
      ) : null}
      {uploadError ? (
        <p className="text-xs text-destructive print:hidden">{uploadError}</p>
      ) : null}

      {(photoOnFile || previewUrl) && (
        <div className="space-y-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Signed pack on file
            </p>
            {previewUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setPackLightboxOpen(true)}
              >
                <ExpandIcon className="size-3.5" />
                Open full size
              </Button>
            ) : null}
          </div>
          {previewUrl ? (
            <button
              type="button"
              onClick={() => setPackLightboxOpen(true)}
              className={cn(
                "group relative flex w-full cursor-zoom-in items-center justify-center",
                "min-h-[14rem] rounded-md border bg-muted/30 p-2 text-left",
                "outline-none transition hover:border-accent focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Open signed pack full size"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Guide signed pack — tap to enlarge"
                className="max-h-[min(70vh,32rem)] w-auto max-w-full object-contain"
              />
              <span className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm opacity-90 group-hover:opacity-100">
                Tap to enlarge
              </span>
            </button>
          ) : null}

          <Dialog open={packLightboxOpen} onOpenChange={setPackLightboxOpen}>
            <DialogContent
              className="erp flex max-h-[95vh] max-w-[min(96vw,56rem)] flex-col gap-3 overflow-hidden p-3 sm:p-4"
              showCloseButton
            >
              <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
                <DialogTitle className="text-base">
                  Signed settlement pack
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {guestName || "Guest"}
                  {rooms.length ? ` · ${rooms.join(", ")}` : ""}
                  {agentName ? ` · ${agentName}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-auto rounded-md bg-muted/40 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullUrl ?? previewUrl ?? undefined}
                  alt="Guide signed pack full size"
                  className="mx-auto h-auto max-h-[calc(95vh-7rem)] w-auto max-w-full object-contain"
                />
              </div>
              {fullUrl ? (
                <div className="flex shrink-0 justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={fullUrl} target="_blank" rel="noreferrer">
                      Open in new tab
                    </a>
                  </Button>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {waived ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs print:hidden">
          Guide sign waived — check audit for reason.
        </p>
      ) : null}

      {!canLeave && !waived ? (
        <form action={waiveAction} className="space-y-2 border-t pt-3 print:hidden">
          <input type="hidden" name="booking_id" value={bookingId} />
          <Label htmlFor="waive_reason" className="text-xs">
            Waive (guide already left)
          </Label>
          <Input
            id="waive_reason"
            name="waive_reason"
            value={waiveReason}
            onChange={(e) => setWaiveReason(e.target.value)}
            placeholder="Reason (min 4 chars)"
            className="h-10"
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={waivePending || waiveReason.trim().length < 4}
          >
            Record waive
          </Button>
        </form>
      ) : null}

      {canLeave ? (
        <div className="space-y-2 border-t pt-3 print:hidden">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            After guests leave
          </p>
          <form action={sealAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="booking_id" value={bookingId} />
            <Button type="submit" variant="secondary" disabled={sealPending}>
              {sealPending ? "Sealing…" : "Seal pack"}
            </Button>
          </form>
          <form action={emailAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="booking_id" value={bookingId} />
            {packs[0] ? (
              <input type="hidden" name="pack_id" value={packs[0].id} />
            ) : null}
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="email_to" className="text-xs">
                Email agent
              </Label>
              <Input
                id="email_to"
                name="to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="h-10"
              />
            </div>
            <Button type="submit" variant="outline" disabled={emailPending}>
              <MailIcon className="size-4" />
              {emailPending ? "Sending…" : "Email"}
            </Button>
          </form>
          {packs[0] ? (
            <p className="text-[11px] text-muted-foreground">
              Last sealed {new Date(packs[0].sealedAt).toLocaleString()}
              {packs[0].emailSentAt
                ? ` · emailed ${packs[0].emailTo ?? ""}`
                : " · not emailed"}
              {" · "}
              <Link
                href={`/erp/bookings/${bookingId}/settlement-pack`}
                className="underline-offset-2 hover:underline"
              >
                Open pack page
              </Link>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              <Link
                href={`/erp/bookings/${bookingId}/settlement-pack`}
                className="underline-offset-2 hover:underline"
              >
                Settlement pack page
              </Link>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
