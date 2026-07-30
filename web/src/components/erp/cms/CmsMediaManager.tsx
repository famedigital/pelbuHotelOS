"use client";

import {
  addCmsMedia,
  deleteCmsMedia,
  moveCmsMedia,
  updateCmsMedia,
  type CmsMediaState,
} from "@/app/actions/erp-cms-media";
import {
  CloudinaryPicker,
  type CloudinaryPickerSelection,
} from "@/components/erp/CloudinaryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CMS_MEDIA_KINDS,
  type CmsMediaGroup,
  type CmsMediaKind,
  type CmsMediaRow,
} from "@/lib/cms-media-admin";
import {
  cloudinaryMediaThumbUrl,
  type CloudinaryResourceType,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const KIND_LABELS: Record<CmsMediaKind, string> = {
  hero: "Hero",
  gallery: "Gallery",
  thumb: "Thumbnail",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const EMPTY: CmsMediaState = { ok: false };

function thumb(
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
  posterPublicId?: string | null,
): string | null {
  return cloudinaryMediaThumbUrl(
    posterPublicId || publicId,
    posterPublicId ? "image" : resourceType,
    { width: 400, height: 260, crop: "fill" },
  );
}

function MediaCardRow({ item }: { item: CmsMediaRow }) {
  const [state, formAction, pending] = useActionState(updateCmsMedia, EMPTY);
  const src = thumb(item.public_id, item.resource_type, item.poster_public_id);
  const isVideo = item.resource_type === "video";

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[3/2] w-full bg-muted">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.alt || item.public_id}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6" aria-hidden />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge variant="secondary">{KIND_LABELS[item.kind]}</Badge>
          {isVideo ? <Badge variant="secondary">Video</Badge> : null}
          {!item.is_published ? (
            <Badge variant="outline">Hidden</Badge>
          ) : null}
        </div>
      </div>

      <form action={formAction} className="flex flex-1 flex-col gap-3 p-3">
        <input type="hidden" name="media_id" value={item.id} />
        <p
          className="truncate font-mono text-[11px] text-muted-foreground"
          title={item.public_id}
        >
          {item.public_id}
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor={`alt-${item.id}`} className="text-xs">
            Alt text
          </Label>
          <Input
            id={`alt-${item.id}`}
            name="alt"
            defaultValue={item.alt}
            maxLength={200}
            placeholder="Describe the photo or clip for screen readers"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`kind-${item.id}`} className="text-xs">
              Role
            </Label>
            <select
              id={`kind-${item.id}`}
              name="kind"
              defaultValue={item.kind}
              className={selectClass}
            >
              {CMS_MEDIA_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`pub-${item.id}`} className="text-xs">
              Visibility
            </Label>
            <select
              id={`pub-${item.id}`}
              name="is_published"
              defaultValue={item.is_published ? "1" : "0"}
              className={selectClass}
            >
              <option value="1">Live on site</option>
              <option value="0">Hidden</option>
            </select>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.error ? (
            <span className="text-xs text-destructive">{state.error}</span>
          ) : state.ok ? (
            <span className="text-xs text-muted-foreground">{state.message}</span>
          ) : null}
        </div>
      </form>

      <div className="flex items-center gap-1.5 border-t px-3 py-2">
        <form action={moveCmsMedia}>
          <input type="hidden" name="media_id" value={item.id} />
          <input type="hidden" name="direction" value="up" />
          <Button type="submit" size="sm" variant="ghost" aria-label="Move up">
            <ArrowUpIcon className="size-4" aria-hidden />
          </Button>
        </form>
        <form action={moveCmsMedia}>
          <input type="hidden" name="media_id" value={item.id} />
          <input type="hidden" name="direction" value="down" />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            aria-label="Move down"
          >
            <ArrowDownIcon className="size-4" aria-hidden />
          </Button>
        </form>
        <form action={deleteCmsMedia} className="ml-auto">
          <input type="hidden" name="media_id" value={item.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon className="size-4" aria-hidden />
            Remove
          </Button>
        </form>
      </div>
    </li>
  );
}

function AddMediaForm({ pageSlug }: { pageSlug: string }) {
  const [state, formAction, pending] = useActionState(addCmsMedia, EMPTY);
  const [publicId, setPublicId] = useState("");
  const [resourceType, setResourceType] =
    useState<CloudinaryResourceType>("image");
  const [meta, setMeta] = useState<CloudinaryPickerSelection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const preview = publicId ? thumb(publicId, resourceType) : null;

  function applySelection(id: string, selection?: CloudinaryPickerSelection) {
    setPublicId(id);
    if (selection) {
      setResourceType(selection.resourceType);
      setMeta(selection);
    } else {
      setResourceType("image");
      setMeta(null);
    }
    setPickerOpen(false);
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border border-dashed bg-card p-4"
    >
      <input type="hidden" name="page_slug" value={pageSlug} />
      <input type="hidden" name="resource_type" value={resourceType} />
      {meta?.format ? (
        <input type="hidden" name="format" value={meta.format} />
      ) : null}
      {meta?.bytes ? (
        <input type="hidden" name="bytes" value={String(meta.bytes)} />
      ) : null}
      {meta?.width ? (
        <input type="hidden" name="width" value={String(meta.width)} />
      ) : null}
      {meta?.height ? (
        <input type="hidden" name="height" value={String(meta.height)} />
      ) : null}
      {meta?.durationSec != null ? (
        <input
          type="hidden"
          name="duration_sec"
          value={String(meta.durationSec)}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[240px] flex-1 gap-1.5">
          <Label htmlFor={`public-id-${pageSlug}`}>Cloudinary public ID</Label>
          <Input
            id={`public-id-${pageSlug}`}
            name="public_id"
            value={publicId}
            onChange={(event) => {
              setPublicId(event.target.value);
              setMeta(null);
            }}
            placeholder="pelbu/brand/lobby"
            required
          />
        </div>
        <div className="grid w-36 gap-1.5">
          <Label htmlFor={`resource-${pageSlug}`}>Type</Label>
          <select
            id={`resource-${pageSlug}`}
            value={resourceType}
            onChange={(event) =>
              setResourceType(event.target.value as CloudinaryResourceType)
            }
            className={selectClass}
          >
            <option value="image">Photo</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div className="grid w-40 gap-1.5">
          <Label htmlFor={`new-kind-${pageSlug}`}>Role</Label>
          <select
            id={`new-kind-${pageSlug}`}
            name="kind"
            defaultValue="gallery"
            className={selectClass}
          >
            {CMS_MEDIA_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-[240px] flex-1 gap-1.5">
          <Label htmlFor={`new-alt-${pageSlug}`}>Alt text</Label>
          <Input
            id={`new-alt-${pageSlug}`}
            name="alt"
            maxLength={200}
            placeholder="Deluxe suite with mountain view"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPickerOpen(true)}
        >
          <ImageIcon className="size-4" aria-hidden />
          Browse
        </Button>
        <Button type="submit" disabled={pending}>
          <PlusIcon className="size-4" aria-hidden />
          {pending
            ? "Adding…"
            : resourceType === "video"
              ? "Add video"
              : "Add image"}
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Hero media replaces the built-in banner slides for this page. Videos
        stream adaptively (HLS) on the public site.
      </p>

      {preview ? (
        <div className="relative mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="h-24 w-36 rounded-lg object-cover"
          />
          {resourceType === "video" ? (
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
              Video
            </span>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      ) : state.ok ? (
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      ) : null}

      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={applySelection}
        uploadFolder={`pelbu/${pageSlug}`}
        title="Choose page photography or video"
        description="Pick an existing Cloudinary asset or upload from this device. Video clips are supported."
      />
    </form>
  );
}

export function CmsMediaManager({ groups }: { groups: CmsMediaGroup[] }) {
  const [active, setActive] = useState(groups[0]?.page_slug ?? "home");
  const group = useMemo(
    () => groups.find((g) => g.page_slug === active) ?? groups[0],
    [groups, active],
  );

  if (!group) {
    return (
      <p className="text-sm text-muted-foreground">
        No public pages found for this property yet.
      </p>
    );
  }

  const heroCount = group.items.filter(
    (item) => item.kind === "hero" && item.is_published,
  ).length;
  const videoCount = group.items.filter(
    (item) => item.resource_type === "video",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <div className="flex items-start gap-2.5">
          <SmartphoneIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-medium text-foreground">Phone capture</p>
            <p className="text-muted-foreground">
              Open on a phone to shoot high-res photos or video straight into
              Cloudinary, then arrange them here on desktop.
            </p>
          </div>
        </div>
        <Button asChild variant="citrus" size="sm">
          <Link href="/erp/front-public/media/upload">
            <VideoIcon className="size-4" aria-hidden />
            Open phone upload
          </Link>
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Public pages"
      >
        {groups.map((entry) => {
          const selected = entry.page_slug === group.page_slug;
          return (
            <button
              key={entry.page_slug}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(entry.page_slug)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "border-transparent bg-accent text-white"
                  : "border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.page_slug}
              <span className="ml-1.5 tabular-nums opacity-70">
                {entry.items.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {group.items.length} asset{group.items.length === 1 ? "" : "s"} on{" "}
          <span className="font-medium text-foreground">{group.page_slug}</span>
          {videoCount > 0 ? (
            <span className="ml-1">
              · {videoCount} video{videoCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
        {group.page_slug === "home" ? (
          <Badge variant={heroCount > 0 ? "secondary" : "outline"}>
            {heroCount > 0
              ? `${heroCount} hero slide${heroCount === 1 ? "" : "s"} live`
              : "Using built-in hero slides"}
          </Badge>
        ) : null}
      </div>

      <AddMediaForm pageSlug={group.page_slug} />

      {group.items.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No media yet for this page. Add photos or video above — hero items run
          in the page banner, gallery items fill the photo strips.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {group.items.map((item) => (
            <MediaCardRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
