"use client";

import { addCmsMedia } from "@/app/actions/erp-cms-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CMS_MEDIA_KINDS,
  type CmsMediaKind,
} from "@/lib/cms-media-admin";
import {
  cloudinaryMediaThumbUrl,
} from "@/lib/cloudinary";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  uploadToCloudinary,
  type CloudinaryUploadResult,
} from "@/lib/cloudinary-direct-upload";
import { cn } from "@/lib/utils";
import {
  CameraIcon,
  CheckCircle2Icon,
  ImagePlusIcon,
  LoaderCircleIcon,
  VideoIcon,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

const KIND_LABELS: Record<CmsMediaKind, string> = {
  hero: "Hero / banner",
  hero_mobile: "Hero (mobile)",
  gallery: "Gallery",
  thumb: "Thumbnail",
};

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type QueueItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "saving" | "done" | "error";
  percent: number;
  error?: string;
  result?: CloudinaryUploadResult;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Phone-first ERP uploader. Camera / gallery files go straight to Cloudinary
 * (chunked for large video), then a desk action attaches them to a CMS page.
 */
export function ErpMediaPhoneUpload({
  pageSlugs,
  defaultPageSlug = "home",
}: {
  pageSlugs: string[];
  defaultPageSlug?: string;
}) {
  const [pageSlug, setPageSlug] = useState(
    pageSlugs.includes(defaultPageSlug) ? defaultPageSlug : pageSlugs[0] ?? "home",
  );
  const [kind, setKind] = useState<CmsMediaKind>("gallery");
  const [alt, setAlt] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, startTransition] = useTransition();
  const cameraPhotoRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const folder = useMemo(() => `pelbu/${pageSlug}`, [pageSlug]);
  const uploading = queue.some(
    (item) => item.status === "uploading" || item.status === "saving",
  );

  function enqueue(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const next: QueueItem[] = [...files].map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      status: "queued",
      percent: 0,
    }));
    setQueue((prev) => [...next, ...prev].slice(0, 20));
    startTransition(() => {
      void processQueue(next);
    });
  }

  async function processQueue(items: QueueItem[]) {
    for (const item of items) {
      setQueue((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, status: "uploading", percent: 0, error: undefined }
            : row,
        ),
      );
      try {
        const uploaded = await uploadToCloudinary(item.file, {
          folder,
          onProgress: (progress) => {
            setQueue((prev) =>
              prev.map((row) =>
                row.id === item.id
                  ? { ...row, percent: progress.percent }
                  : row,
              ),
            );
          },
        });

        setQueue((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? { ...row, status: "saving", percent: 100, result: uploaded }
              : row,
          ),
        );

        const fd = new FormData();
        fd.set("page_slug", pageSlug);
        fd.set("public_id", uploaded.publicId);
        fd.set("kind", kind);
        fd.set("alt", alt || item.file.name.replace(/\.[^.]+$/, ""));
        fd.set("resource_type", uploaded.resourceType);
        if (uploaded.durationSec != null) {
          fd.set("duration_sec", String(uploaded.durationSec));
        }
        fd.set("bytes", String(uploaded.bytes));
        fd.set("width", String(uploaded.width));
        fd.set("height", String(uploaded.height));
        if (uploaded.format) fd.set("format", uploaded.format);

        const saved = await addCmsMedia({ ok: false }, fd);
        if (!saved.ok) throw new Error(saved.error ?? "Could not save media.");

        setQueue((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, status: "done" } : row,
          ),
        );
        toast.success(
          uploaded.resourceType === "video"
            ? "Video uploaded and attached."
            : "Photo uploaded and attached.",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";
        setQueue((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? { ...row, status: "error", error: message }
              : row,
          ),
        );
        toast.error(message);
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 pb-10">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="phone-page">Attach to page</Label>
            <select
              id="phone-page"
              className={selectClass}
              value={pageSlug}
              onChange={(event) => setPageSlug(event.target.value)}
              disabled={uploading || busy}
            >
              {pageSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone-kind">Role</Label>
            <select
              id="phone-kind"
              className={selectClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as CmsMediaKind)}
              disabled={uploading || busy}
            >
              {CMS_MEDIA_KINDS.map((value) => (
                <option key={value} value={value}>
                  {KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone-alt">Caption / alt text</Label>
            <Input
              id="phone-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Deluxe suite — mountain light"
              maxLength={200}
              className="h-11 rounded-xl text-base"
              disabled={uploading || busy}
            />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Uploads go straight to Cloudinary folder{" "}
          <span className="font-mono">{folder}</span>. Photos up to{" "}
          {formatBytes(MAX_IMAGE_BYTES)}; videos up to{" "}
          {formatBytes(MAX_VIDEO_BYTES)}. Videos stream with automatic
          bandwidth adaptation on the public site.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <Button
          type="button"
          size="lg"
          className="h-14 rounded-2xl text-base"
          variant="citrus"
          disabled={uploading || busy}
          onClick={() => cameraPhotoRef.current?.click()}
        >
          <CameraIcon className="size-5" aria-hidden />
          Take photo
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-14 rounded-2xl text-base"
          variant="outline"
          disabled={uploading || busy}
          onClick={() => cameraVideoRef.current?.click()}
        >
          <VideoIcon className="size-5" aria-hidden />
          Record / capture video
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-14 rounded-2xl text-base"
          variant="outline"
          disabled={uploading || busy}
          onClick={() => libraryRef.current?.click()}
        >
          <ImagePlusIcon className="size-5" aria-hidden />
          Choose from gallery
        </Button>
      </section>

      <input
        ref={cameraPhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          enqueue(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraVideoRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          enqueue(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => {
          enqueue(event.target.files);
          event.target.value = "";
        }}
      />

      {queue.length > 0 ? (
        <ul className="space-y-3">
          {queue.map((item) => {
            const thumb = item.result
              ? cloudinaryMediaThumbUrl(
                  item.result.publicId,
                  item.result.resourceType,
                  { width: 160, height: 120, crop: "fill" },
                )
              : null;
            return (
              <li
                key={item.id}
                className="flex gap-3 rounded-2xl border bg-card p-3"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      {item.file.type.startsWith("video/") ? (
                        <VideoIcon className="size-5" aria-hidden />
                      ) : (
                        <CameraIcon className="size-5" aria-hidden />
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                    {item.result?.resourceType
                      ? ` · ${item.result.resourceType}`
                      : ""}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        item.status === "error"
                          ? "bg-destructive"
                          : "bg-accent",
                      )}
                      style={{
                        width: `${item.status === "done" ? 100 : item.percent}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.status === "uploading" || item.status === "saving" ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                    ) : null}
                    {item.status === "done" ? (
                      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                    ) : null}
                    {item.status === "queued" && "Waiting…"}
                    {item.status === "uploading" && `Uploading ${item.percent}%`}
                    {item.status === "saving" && "Saving to CMS…"}
                    {item.status === "done" && "Attached to page"}
                    {item.status === "error" && (item.error ?? "Failed")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Use the camera buttons above. After upload, open Media library on
          desktop to reorder or set visibility.
        </p>
      )}
    </div>
  );
}
