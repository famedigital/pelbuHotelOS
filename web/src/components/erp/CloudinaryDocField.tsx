"use client";

import { Button } from "@/components/ui/button";
import { cloudinaryUrl, parseCloudinaryUrl } from "@/lib/cloudinary";
import { CameraIcon, FileTextIcon, XIcon } from "lucide-react";

export type DocPickIntent = "camera" | "file";

/**
 * Shows the currently attached document and asks the parent to open the
 * Cloudinary picker. The dialog itself is owned once per form, so a booking
 * with ten guests does not mount ten pickers.
 *
 * Empty state offers two desk-friendly paths:
 *  - Camera — phone/tablet rear camera (or webcam) for a quick photo
 *  - PDF / file — scanned PDF or image from gallery/files (attach later)
 *
 * The value stays a plain delivery URL: `booking_guests.sdf_doc_url` is read
 * as an `href` on the guests board and may already hold links from before
 * Cloudinary, so storing a bare public ID would break both.
 */
export function CloudinaryDocField({
  value,
  name,
  onPick,
  onClear,
  describedBy,
}: {
  value: string;
  name: string;
  onPick: (intent: DocPickIntent) => void;
  onClear: () => void;
  describedBy?: string;
}) {
  const parsed = value ? parseCloudinaryUrl(value) : null;
  const isPdf =
    Boolean(parsed && parsed.publicId) &&
    (/\.pdf$/i.test(value) || /\/image\/upload\/.*\.pdf/i.test(value));
  const thumb =
    parsed && !isPdf
      ? cloudinaryUrl(parsed.publicId, { width: 80, height: 80, crop: "fit" })
      : null;

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      {value ? (
        <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-describedby={describedBy}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="size-8 shrink-0 rounded border bg-muted/30 object-contain"
              />
            ) : (
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-accent underline-offset-4 hover:underline">
              {docName(value)}
            </span>
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            aria-label="Retake with camera"
            title="Camera"
            onClick={() => onPick("camera")}
          >
            <CameraIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            aria-label="Replace with PDF or file"
            title="PDF / file"
            onClick={() => onPick("file")}
          >
            <FileTextIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove document"
            onClick={onClear}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-1.5"
          role="group"
          aria-describedby={describedBy}
          aria-label="Attach SDF document"
        >
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-0 justify-center gap-1.5 px-2 text-xs font-normal"
            onClick={() => onPick("camera")}
          >
            <CameraIcon className="size-3.5 shrink-0" />
            <span className="truncate">Camera</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-0 justify-center gap-1.5 px-2 text-xs font-normal"
            onClick={() => onPick("file")}
          >
            <FileTextIcon className="size-3.5 shrink-0" />
            <span className="truncate">PDF / file</span>
          </Button>
        </div>
      )}
    </div>
  );
}

function docName(url: string): string {
  const parsed = parseCloudinaryUrl(url);
  if (parsed) return parsed.publicId.split("/").pop() ?? parsed.publicId;
  try {
    const path = new URL(url).pathname;
    return path.split("/").filter(Boolean).pop() ?? url;
  } catch {
    return url;
  }
}
