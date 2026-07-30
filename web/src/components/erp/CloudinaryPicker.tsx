"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cloudinaryMediaThumbUrl,
  type CloudinaryResourceType,
} from "@/lib/cloudinary";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  uploadToCloudinary,
} from "@/lib/cloudinary-direct-upload";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ImageIcon,
  UploadCloudIcon,
  VideoIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type CloudinaryAssetSummary = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  format: string;
  bytes: number;
  width: number;
  height: number;
  durationSec?: number | null;
  uploadedAt: string;
};

export type CloudinaryPickerSelection = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  format: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number | null;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetName(publicId: string): string {
  return publicId.split("/").pop() ?? publicId;
}

/**
 * Cloudinary media gallery in a modal: browse images/videos already in the
 * account, or upload from camera/gallery straight to Cloudinary (never through
 * a server action).
 */
export function CloudinaryPicker({
  open,
  onOpenChange,
  onSelect,
  uploadFolder = "pelbu/brand",
  title = "Cloudinary media",
  description = "Pick an existing asset or upload a new photo/video. Only the Cloudinary public ID is saved.",
  acceptVideo = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (publicId: string, meta?: CloudinaryPickerSelection) => void;
  uploadFolder?: string;
  title?: string;
  description?: string;
  acceptVideo?: boolean;
}) {
  const [tab, setTab] = useState("library");
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">(
    acceptVideo ? "all" : "image",
  );
  const [assets, setAssets] = useState<CloudinaryAssetSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CloudinaryAssetSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (nextCursor?: string) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (folder) params.set("folder", folder);
        if (query.trim()) params.set("q", query.trim());
        if (nextCursor) params.set("cursor", nextCursor);
        params.set("type", acceptVideo ? typeFilter : "image");
        const response = await fetch(
          `/api/erp/cloudinary/library?${params.toString()}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        const body = (await response.json()) as {
          assets?: Array<{
            publicId: string;
            resourceType?: CloudinaryResourceType;
            format: string;
            bytes: number;
            width: number;
            height: number;
            durationSec?: number | null;
            uploadedAt: string;
          }>;
          nextCursor?: string | null;
          total?: number;
          folders?: string[] | null;
          error?: string;
        };
        if (id !== requestId.current) return;
        if (!response.ok) {
          throw new Error(body.error ?? "Could not load Cloudinary media.");
        }
        const page = (body.assets ?? []).map((asset) => ({
          ...asset,
          resourceType: asset.resourceType ?? "image",
        }));
        setAssets((prev) => (nextCursor ? [...prev, ...page] : page));
        setCursor(body.nextCursor ?? null);
        setTotal(body.total ?? page.length);
        if (body.folders) setFolders(body.folders);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(
          e instanceof Error ? e.message : "Could not load Cloudinary media.",
        );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [folder, query, typeFilter, acceptVideo],
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, load, query]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(null);
      setQuery("");
      setTab("library");
      setUploadPercent(0);
    }
    onOpenChange(next);
  }

  function confirmSelection(asset?: CloudinaryAssetSummary | null) {
    const chosen = asset ?? selected;
    if (!chosen) return;
    onSelect(chosen.publicId, {
      publicId: chosen.publicId,
      resourceType: chosen.resourceType,
      format: chosen.format,
      bytes: chosen.bytes,
      width: chosen.width,
      height: chosen.height,
      durationSec: chosen.durationSec ?? null,
    });
    handleOpenChange(false);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadPercent(0);
    try {
      const uploaded = await uploadToCloudinary(file, {
        folder: uploadFolder,
        onProgress: (progress) => setUploadPercent(progress.percent),
      });
      if (!acceptVideo && uploaded.resourceType === "video") {
        throw new Error("This field only accepts images.");
      }

      const asset: CloudinaryAssetSummary = {
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        format: uploaded.format,
        bytes: uploaded.bytes,
        width: uploaded.width,
        height: uploaded.height,
        durationSec: uploaded.durationSec,
        uploadedAt: new Date().toISOString(),
      };
      setAssets((prev) => [
        asset,
        ...prev.filter((row) => row.publicId !== asset.publicId),
      ]);
      setSelected(asset);
      setTab("library");
      toast.success(`Uploaded ${assetName(asset.publicId)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const previewUrl = selected
    ? cloudinaryMediaThumbUrl(selected.publicId, selected.resourceType, {
        width: 96,
        height: 96,
        crop: "fit",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="erp flex max-h-[92dvh] flex-col gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="library">
              <ImageIcon />
              Media library
            </TabsTrigger>
            <TabsTrigger value="upload">
              <UploadCloudIcon />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="library"
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search file name or tag…"
                aria-label="Search Cloudinary media"
                className="h-9 max-w-[240px]"
              />
              <select
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                aria-label="Filter by Cloudinary folder"
                className={cn(selectClass, "w-[220px]")}
              >
                <option value="">All folders</option>
                {folders.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
              {acceptVideo ? (
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as typeof typeFilter)
                  }
                  aria-label="Filter by media type"
                  className={cn(selectClass, "w-[140px]")}
                >
                  <option value="all">Photos + video</option>
                  <option value="image">Photos</option>
                  <option value="video">Video</option>
                </select>
              ) : null}
              <span className="text-xs text-muted-foreground tabular-nums">
                {loading && assets.length === 0
                  ? "Loading…"
                  : `${assets.length} of ${total}`}
              </span>
            </div>

            {error ? (
              <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-3"
                  onClick={() => void load()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border bg-muted/10 p-3">
              {assets.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {loading
                    ? "Loading Cloudinary media…"
                    : "No media match. Try another folder or upload a new file."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {assets.map((asset) => {
                    const thumb = cloudinaryMediaThumbUrl(
                      asset.publicId,
                      asset.resourceType,
                      { width: 400, height: 400, crop: "fit" },
                    );
                    const isSelected = selected?.publicId === asset.publicId;
                    return (
                      <button
                        key={asset.publicId}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelected(asset)}
                        onDoubleClick={() => confirmSelection(asset)}
                        title={`${asset.publicId} — double-click to use`}
                        className={cn(
                          "group relative cursor-pointer overflow-hidden rounded-xl border bg-card text-left transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                          isSelected
                            ? "border-accent ring-2 ring-accent/40"
                            : "hover:border-accent/60 hover:shadow-md",
                        )}
                      >
                        <span className="relative flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#0000000a_0%_25%,transparent_0%_50%)] bg-[length:14px_14px] p-2">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={asset.publicId}
                              loading="lazy"
                              className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <ImageIcon className="size-5 text-muted-foreground" />
                          )}
                          {asset.resourceType === "video" ? (
                            <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Video
                            </span>
                          ) : null}
                          {isSelected ? (
                            <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
                              <CheckIcon className="size-3" />
                            </span>
                          ) : null}
                        </span>
                        <span className="block border-t bg-card px-2.5 py-2">
                          <span className="block truncate text-xs font-medium text-foreground">
                            {assetName(asset.publicId)}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground tabular-nums">
                            {asset.format.toUpperCase() || asset.resourceType} ·{" "}
                            {formatBytes(asset.bytes)}
                            {asset.width
                              ? ` · ${asset.width}×${asset.height}`
                              : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {cursor ? (
                <div className="pt-3 text-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void load(cursor)}
                    disabled={loading}
                  >
                    {loading ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent
            value="upload"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto"
          >
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void uploadFile(file);
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
                dragging ? "border-accent bg-accent/5" : "bg-muted/20",
              )}
            >
              <UploadCloudIcon className="size-6 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {uploading
                    ? `Uploading… ${uploadPercent}%`
                    : acceptVideo
                      ? "Drop a photo or video here"
                      : "Drop an image here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Photos to {formatBytes(MAX_IMAGE_BYTES)}
                  {acceptVideo
                    ? ` · videos to ${formatBytes(MAX_VIDEO_BYTES)}`
                    : ""}{" "}
                  — saved to <span className="font-mono">{uploadFolder}</span>
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Label htmlFor="cloudinary-upload-file" className="sr-only">
                  Choose media to upload
                </Label>
                <input
                  id="cloudinary-upload-file"
                  type="file"
                  accept={acceptVideo ? "image/*,video/*" : "image/*"}
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadFile(file);
                  }}
                  className="block max-w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-muted"
                />
              </div>
              {acceptVideo ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <VideoIcon className="size-3.5" aria-hidden />
                  Large phone videos upload in chunks directly to Cloudinary.
                </p>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="shrink-0 items-center border-t pt-3 sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="size-9 shrink-0 rounded border bg-muted/30 object-contain"
              />
            ) : null}
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {selected?.publicId ?? "Nothing selected"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="citrus"
              onClick={() => confirmSelection()}
              disabled={!selected || uploading}
            >
              Use this media
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
