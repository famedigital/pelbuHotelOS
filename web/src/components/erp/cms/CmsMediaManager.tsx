"use client";

import {
  addCmsMedia,
  deleteCmsMedia,
  moveCmsMedia,
  replaceCmsMediaAsset,
  updateCmsMedia,
  type CmsMediaState,
} from "@/app/actions/erp-cms-media";
import {
  CloudinaryPicker,
  type CloudinaryPickerSelection,
} from "@/components/erp/CloudinaryPicker";
import { ImageFramePanEditor } from "@/components/erp/cms/ImageFramePanEditor";
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
  cloudinaryUrl,
  type CloudinaryResourceType,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  PlusIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

const KIND_LABELS: Record<CmsMediaKind, string> = {
  hero: "Hero (desktop)",
  hero_mobile: "Hero (mobile)",
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
  focalX = 0.5,
  focalY = 0.5,
  width = 400,
  height = 260,
): string | null {
  return cloudinaryMediaThumbUrl(
    posterPublicId || publicId,
    posterPublicId ? "image" : resourceType,
    {
      width,
      height,
      crop: "fill",
      gravity: { x: focalX, y: focalY },
    },
  );
}

function MediaCardRow({ item }: { item: CmsMediaRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateCmsMedia, EMPTY);
  const [replaceState, replaceAction, replacePending] = useActionState(
    replaceCmsMediaAsset,
    EMPTY,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingId, setPendingId] = useState(item.public_id);
  const [pendingType, setPendingType] = useState<CloudinaryResourceType>(
    item.resource_type,
  );
  const [focalX, setFocalX] = useState(item.focal_x);
  const [focalY, setFocalY] = useState(item.focal_y);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    setPendingId(item.public_id);
    setPendingType(item.resource_type);
    setFocalX(item.focal_x);
    setFocalY(item.focal_y);
  }, [item.public_id, item.resource_type, item.focal_x, item.focal_y]);

  useEffect(() => {
    if (replaceState.ok) {
      startRefresh(() => router.refresh());
    }
  }, [replaceState.ok, router]);

  const src = thumb(
    pendingId,
    pendingType,
    item.poster_public_id,
    focalX,
    focalY,
  );
  const panSource =
    pendingType === "video"
      ? thumb(pendingId, pendingType, item.poster_public_id, 0.5, 0.5, 900, 1200)
      : cloudinaryUrl(item.poster_public_id || pendingId, {
          width: 1400,
          crop: "limit",
          quality: "auto:good",
        });
  const isVideo = pendingType === "video";
  const busy = pending || replacePending || isRefreshing;
  const isMobileHero = item.kind === "hero_mobile";
  const isDeskHero = item.kind === "hero";

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[3/2] w-full bg-muted">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.alt || pendingId}
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${focalX * 100}% ${focalY * 100}%`,
            }}
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
        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 gap-1.5 bg-white/95 text-foreground hover:bg-white"
            disabled={busy}
            onClick={() => setPickerOpen(true)}
          >
            <RefreshCwIcon className="size-3.5" aria-hidden />
            {replacePending ? "Replacing…" : "Change photo"}
          </Button>
        </div>
      </div>

      <form action={formAction} className="flex flex-1 flex-col gap-3 p-3">
        <input type="hidden" name="media_id" value={item.id} />
        <input type="hidden" name="focal_x" value={focalX} />
        <input type="hidden" name="focal_y" value={focalY} />
        <p
          className="truncate font-mono text-[11px] text-muted-foreground"
          title={pendingId}
        >
          {pendingId}
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor={`alt-${item.id}`} className="text-xs">
            Alt text
            {item.kind === "hero" || item.kind === "hero_mobile" ? (
              <span className="ml-1 font-normal text-muted-foreground">
                (hero caption)
              </span>
            ) : null}
          </Label>
          <Input
            id={`alt-${item.id}`}
            name="alt"
            defaultValue={item.alt}
            maxLength={200}
            placeholder="Describe the photo or clip for screen readers"
          />
        </div>

        {!isVideo ? (
          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {isMobileHero
                ? "Mobile hero: drag the photo up/down (like Android) so the right face of the image sits in the phone frame. Saves live on the public site after you hit Save."
                : isDeskHero
                  ? "Desktop hero: drag inside the wide frame so the right part of the landscape shows on large screens."
                  : "Drag inside the frame to choose what stays visible when the photo is cropped on the site."}
            </p>
            {isMobileHero || (!isDeskHero && !isMobileHero) ? (
              <ImageFramePanEditor
                imageSrc={panSource}
                focalX={focalX}
                focalY={focalY}
                onChange={(x, y) => {
                  setFocalX(x);
                  setFocalY(y);
                }}
                aspect="9/16"
                label={isMobileHero ? "Phone frame · slide to crop" : "Tall crop"}
                hint="Drag image · slider · arrow keys"
                phoneChrome={isMobileHero}
                verticalBias
              />
            ) : null}
            {isDeskHero || (!isDeskHero && !isMobileHero) ? (
              <ImageFramePanEditor
                imageSrc={panSource}
                focalX={focalX}
                focalY={focalY}
                onChange={(x, y) => {
                  setFocalX(x);
                  setFocalY(y);
                }}
                aspect="16/9"
                label={isDeskHero ? "Desktop frame · slide to crop" : "Wide crop"}
                hint="Same numbers power both frames if you only set one"
              />
            ) : null}
            {isMobileHero ? (
              <p className="text-[11px] text-muted-foreground">
                Tip: keep a separate <strong>Hero (mobile)</strong> asset when
                phone and desktop need different photos or framing.
              </p>
            ) : null}
          </div>
        ) : null}

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

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={busy}>
            {pending ? "Saving…" : "Save details"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setPickerOpen(true)}
          >
            Change photo
          </Button>
          {state.error || replaceState.error ? (
            <span className="text-xs text-destructive">
              {state.error ?? replaceState.error}
            </span>
          ) : state.ok || replaceState.ok ? (
            <span className="text-xs text-muted-foreground">
              {replaceState.message ?? state.message}
            </span>
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

      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        uploadFolder={`pelbu/${item.page_slug}`}
        title={
          item.kind === "hero"
            ? "Change hero slide photo"
            : "Change media photo or video"
        }
        description="Pick a library asset or upload a new file. This replaces the live image without removing the slide."
        onSelect={(id, meta?: CloudinaryPickerSelection) => {
          setPendingId(id);
          setPendingType(meta?.resourceType ?? "image");
          setPickerOpen(false);
          const fd = new FormData();
          fd.set("media_id", item.id);
          fd.set("public_id", id);
          fd.set("resource_type", meta?.resourceType ?? "image");
          if (meta?.format) fd.set("format", meta.format);
          if (meta?.bytes != null) fd.set("bytes", String(meta.bytes));
          if (meta?.width) fd.set("width", String(meta.width));
          if (meta?.height) fd.set("height", String(meta.height));
          if (meta?.durationSec != null) {
            fd.set("duration_sec", String(meta.durationSec));
          }
          // useActionState dispatcher accepts FormData when invoked as form action;
          // also works as (prev, formData) — React 19 uses (payload).
          void replaceAction(fd);
        }}
      />
    </li>
  );
}

function AddMediaForm({
  pageSlug,
  defaultKind = "gallery",
}: {
  pageSlug: string;
  defaultKind?: CmsMediaKind;
}) {
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
            defaultValue={defaultKind}
            key={`${pageSlug}-${defaultKind}`}
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
        Set Role to <strong>Hero</strong> for homepage slider slides (order =
        slide order). Gallery fills photo strips. Use{" "}
        <strong>Change photo</strong> on a card to swap an existing slide image.
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
              : "Using built-in hero slides — add with Role: Hero"}
          </Badge>
        ) : null}
      </div>

      {group.page_slug === "home" && heroCount === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Homepage hero is still the built-in set</p>
          <p className="mt-1 text-muted-foreground dark:text-amber-100/80">
            To edit the slider: add photos below with Role set to{" "}
            <strong>Hero</strong> (default on home). Order with ↑ ↓ is the
            slide order. On each card, use <strong>Change photo</strong> to
            swap the image without deleting the slide.
          </p>
        </div>
      ) : null}

      <AddMediaForm
        pageSlug={group.page_slug}
        defaultKind={group.page_slug === "home" ? "hero" : "gallery"}
      />

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
