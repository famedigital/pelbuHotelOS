"use client";

import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/cloudinary-direct-upload";
import { CameraIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

export function LaundryPhotoUpload({
  value,
  onChange,
  context,
  label = "Add intake photo",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  context?: { bookingId?: string; orderId?: string };
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file || value.length >= 4) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, {
        folder: "pelbu/laundry",
        signEndpoint: "/api/laundry/sign-upload",
        signContext: context,
        imageOnly: true,
        onProgress: (next) => setProgress(next.percent),
      });
      onChange([...value, result.publicId]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload photo.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full"
        disabled={busy || value.length >= 4}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <CameraIcon className="size-4" />
        )}
        {busy ? "Uploading…" : label}
      </Button>
      {busy ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Photo upload"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {value.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {value.map((id) => (
            <div key={id} className="relative aspect-square overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cloudinaryUrl(id, {
                  width: 320,
                  height: 320,
                  crop: "fill",
                }) ?? undefined}
                alt="Laundry intake"
                className="size-full object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(value.filter((entry) => entry !== id))}
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-background/90 shadow"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
