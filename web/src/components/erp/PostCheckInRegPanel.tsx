"use client";

import {
  saveSignedRegCard,
  type RegCardState,
} from "@/app/actions/erp-checkin";
import {
  type GuestRegistrationCardData,
  type GuestRegistrationPropertyBits,
} from "@/components/erp/GuestRegistrationCard";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/cloudinary-direct-upload";
import type { PropertyRegistrationDesign } from "@/lib/property-settings";
import { printDeskSheet } from "@/lib/desk-print";
import { cn } from "@/lib/utils";
import {
  CameraIcon,
  CheckCircle2Icon,
  FileUpIcon,
  Loader2Icon,
  PrinterIcon,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

const initialSave: RegCardState = { ok: false };

/**
 * After Confirm check-in: print guest registration, then attach signed scan.
 */
export function PostCheckInRegPanel({
  regData,
  regCardPhotoPublicId,
  property,
  design,
  onUploaded,
  onGoFolio,
  onCloseStay,
}: {
  regData: GuestRegistrationCardData;
  regCardPhotoPublicId?: string | null;
  property?: GuestRegistrationPropertyBits;
  design?: PropertyRegistrationDesign | null;
  onUploaded?: (publicId: string) => void;
  onGoFolio: () => void;
  onCloseStay: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  const [localPublicId, setLocalPublicId] = useState(
    regCardPhotoPublicId ?? null,
  );

  const [saveState, saveAction, savePending] = useActionState(
    saveSignedRegCard,
    initialSave,
  );
  useActionToast(saveState, {
    successMessage: saveState.message ?? "Signed registration saved",
  });

  useEffect(() => {
    if (saveState.ok && saveState.regCardPhotoPublicId) {
      setLocalPublicId(saveState.regCardPhotoPublicId);
      onUploaded?.(saveState.regCardPhotoPublicId);
    }
  }, [saveState.ok, saveState.regCardPhotoPublicId, onUploaded]);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, {
        folder: `pelbu/reg-cards/${regData.bookingId}`,
        signEndpoint: "/api/erp/cloudinary/sign-upload",
        imageOnly: false,
        allowPdf: true,
        onProgress: (next) => setProgress(next.percent),
      });
      const fd = new FormData();
      fd.set("booking_id", regData.bookingId);
      fd.set("reg_card_photo_public_id", result.publicId);
      await saveAction(fd);
      setLocalPublicId(result.publicId);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not upload registration.",
      );
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const previewUrl = localPublicId
    ? cloudinaryUrl(localPublicId, {
        width: 640,
        height: 480,
        crop: "limit",
      })
    : null;
  const fullUrl = localPublicId
    ? cloudinaryUrl(localPublicId, { crop: "limit", width: 1200 })
    : null;
  const onFile = Boolean(localPublicId);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-emerald-600/25 bg-emerald-600/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-emerald-800 uppercase dark:text-emerald-300">
          Checked in
        </p>
        <p className="mt-0.5 text-base font-semibold text-foreground">
          {regData.guestName}
        </p>
        <p className="text-xs text-muted-foreground">
          {regData.roomLines.map((r) => r.name).join(" · ")}
          {regData.checkIn
            ? ` · ${regData.checkIn} → ${regData.checkOut}`
            : ""}
        </p>
      </div>

      <div className="space-y-2 rounded-md border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">1 · Print registration</p>
            <p className="text-xs text-muted-foreground">
              Guest signs the A4 card at the desk.
            </p>
          </div>
          {printed ? (
            <CheckCircle2Icon
              className="size-5 shrink-0 text-emerald-600"
              aria-label="Printed"
            />
          ) : null}
        </div>
        <Button
          type="button"
          variant="citrus"
          className="h-11 w-full gap-2"
          onClick={() => {
            setPrinted(true);
            printDeskSheet("reg");
          }}
        >
          <PrinterIcon className="size-4" aria-hidden />
          Print registration card
        </Button>
      </div>

      <div className="space-y-2 rounded-md border bg-card p-3">
        <div>
          <p className="text-sm font-semibold">2 · Upload signed card</p>
          <p className="text-xs text-muted-foreground">
            Photo or scan after guest signs — stays on the booking.
          </p>
        </div>

        {onFile && previewUrl ? (
          <a
            href={fullUrl ?? previewUrl}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Signed registration"
              className="max-h-40 w-full object-contain bg-muted/30"
            />
          </a>
        ) : null}

        {onFile ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2Icon className="size-3.5" aria-hidden />
            Signed registration on file
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-1.5"
            disabled={busy || savePending}
            onClick={() => cameraRef.current?.click()}
          >
            {busy ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <CameraIcon className="size-4" />
            )}
            Camera
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-1.5"
            disabled={busy || savePending}
            onClick={() => fileRef.current?.click()}
          >
            <FileUpIcon className="size-4" />
            File / scan
          </Button>
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
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => void uploadFile(e.target.files?.[0])}
        />
        {busy ? (
          <p className="text-[11px] text-muted-foreground">
            Uploading… {progress}%
          </p>
        ) : null}
        {uploadError || saveState.error ? (
          <p className="text-xs text-destructive" role="alert">
            {uploadError ?? saveState.error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={onGoFolio}
        >
          Go to Folio
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10"
          onClick={onCloseStay}
        >
          Close stay
        </Button>
      </div>
      {!onFile ? (
        <p className="text-center text-[10px] text-muted-foreground">
          You can still upload later from Guest on this stay.
        </p>
      ) : null}
    </div>
  );
}

/** Compact strip for in-house stays — reprint + camera/file after guest signs. */
export function SignedRegCardUploadStrip({
  bookingId,
  regCardPhotoPublicId,
  regData,
  property,
  design,
  onUploaded,
  className,
}: {
  bookingId: string;
  regCardPhotoPublicId?: string | null;
  /** When set, shows Print for re-runs at desk. */
  regData?: GuestRegistrationCardData | null;
  property?: GuestRegistrationPropertyBits;
  design?: PropertyRegistrationDesign | null;
  onUploaded?: () => void;
  className?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localId, setLocalId] = useState(regCardPhotoPublicId ?? null);
  const [saveState, saveAction, savePending] = useActionState(
    saveSignedRegCard,
    initialSave,
  );
  useActionToast(saveState, {
    successMessage: saveState.message ?? "Signed registration saved",
  });

  useEffect(() => {
    setLocalId(regCardPhotoPublicId ?? null);
  }, [regCardPhotoPublicId]);

  useEffect(() => {
    if (saveState.ok) onUploaded?.();
  }, [saveState.ok, onUploaded]);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder: `pelbu/reg-cards/${bookingId}`,
        signEndpoint: "/api/erp/cloudinary/sign-upload",
        imageOnly: false,
        allowPdf: true,
      });
      const fd = new FormData();
      fd.set("booking_id", bookingId);
      fd.set("reg_card_photo_public_id", result.publicId);
      await saveAction(fd);
      setLocalId(result.publicId);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const onFile = Boolean(localId);
  const viewHref = localId
    ? cloudinaryUrl(localId, { crop: "limit", width: 1200 })
    : null;

  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2",
        onFile
          ? "border-emerald-600/25 bg-emerald-600/5"
          : "border-dashed bg-muted/15",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground">
            Registration card
          </p>
          <p className="text-[10px] text-muted-foreground">
            {onFile
              ? "Signed scan on file"
              : "Print → guest signs → camera / file"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {regData ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => printDeskSheet("reg")}
            >
              <PrinterIcon className="size-3.5" />
              Print
            </Button>
          ) : null}
          {onFile && viewHref ? (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <a href={viewHref} target="_blank" rel="noreferrer">
                View
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant={onFile ? "outline" : "citrus"}
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={busy || savePending}
            onClick={() => cameraRef.current?.click()}
          >
            <CameraIcon className="size-3.5" />
            {onFile ? "Replace" : "Camera"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={busy || savePending}
            onClick={() => fileRef.current?.click()}
          >
            <FileUpIcon className="size-3.5" />
            File
          </Button>
        </div>
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
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => void uploadFile(e.target.files?.[0])}
      />
      {saveState.error ? (
        <p className="mt-1 text-[10px] text-destructive">{saveState.error}</p>
      ) : null}
    </div>
  );
}
