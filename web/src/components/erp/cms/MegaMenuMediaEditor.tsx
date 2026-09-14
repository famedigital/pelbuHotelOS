"use client";

import {
  publishMegaMenuMedia,
  saveMegaMenuMediaDraft,
  type MegaMenuMediaState,
} from "@/app/actions/erp-mega-menu";
import {
  CloudinaryPicker,
  type CloudinaryUploadIntent,
} from "@/components/erp/CloudinaryPicker";
import { DeskStickyActionBar } from "@/components/erp/DeskStickyActionBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { MegaMediaSlot } from "@/lib/mega-menu";
import {
  CameraIcon,
  ImagePlusIcon,
  RotateCcwIcon,
  UploadCloudIcon,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";

const EMPTY: MegaMenuMediaState = { ok: false };

function thumb(publicId: string | null): string | null {
  if (!publicId) return null;
  return cloudinaryUrl(publicId, {
    width: 200,
    height: 150,
    crop: "fill",
    gravity: "center",
  });
}

function SlotCard({
  slot,
  displayId,
  isCustom,
  onPick,
  onReset,
}: {
  slot: MegaMediaSlot;
  displayId: string | null;
  isCustom: boolean;
  onPick: (intent: CloudinaryUploadIntent | null) => void;
  onReset: () => void;
}) {
  const preview = thumb(displayId);

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[4/3] bg-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge variant="secondary">
            {slot.kind === "feature" ? "Promo tile" : "Row thumb"}
          </Badge>
          {isCustom ? <Badge variant="citrus">Custom</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{slot.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{slot.href}</p>
          {slot.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {slot.description}
            </p>
          ) : null}
          {displayId ? (
            <p
              className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
              title={displayId}
            >
              {displayId}
            </p>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1"
            onClick={() => onPick(null)}
          >
            <ImagePlusIcon className="size-3.5" aria-hidden />
            Choose
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={() => onPick("file")}
          >
            <UploadCloudIcon className="size-3.5" aria-hidden />
            Upload
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={() => onPick("camera")}
          >
            <CameraIcon className="size-3.5" aria-hidden />
            Capture
          </Button>
          {isCustom ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              onClick={onReset}
              title="Use site default photo again"
            >
              <RotateCcwIcon className="size-3.5" aria-hidden />
              Default
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function MegaMenuMediaEditor({
  slots,
  overrides,
  hasUnpublishedChanges,
}: {
  /** Built with empty media — each slot.publicId is the code default. */
  slots: MegaMediaSlot[];
  /** Draft overrides only (feature keys / item keys). */
  overrides: Record<string, string>;
  hasUnpublishedChanges: boolean;
}) {
  /** key → custom public_id; missing key = use code default on site. */
  const [custom, setCustom] = useState<Record<string, string>>(() => ({
    ...overrides,
  }));

  const [picker, setPicker] = useState<{
    key: string;
    folder: string;
    intent: CloudinaryUploadIntent | null;
  } | null>(null);

  const [saveState, saveAction, savePending] = useActionState(
    saveMegaMenuMediaDraft,
    EMPTY,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishMegaMenuMedia,
    EMPTY,
  );

  const state =
    publishState.message || publishState.error ? publishState : saveState;
  const busy = savePending || publishPending;

  const byMenu = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MegaMediaSlot[]>();
    for (const s of slots) {
      if (!map.has(s.menuLabel)) {
        order.push(s.menuLabel);
        map.set(s.menuLabel, []);
      }
      map.get(s.menuLabel)!.push(s);
    }
    return order.map((menuLabel) => ({
      menuLabel,
      items: map.get(menuLabel)!,
    }));
  }, [slots]);

  return (
    <form action={saveAction} className="space-y-8">
      {Object.entries(custom).map(([key, id]) => {
        if (!id) return null;
        const isFeature = key.startsWith("feature::");
        const name = isFeature ? key : `item::${key}`;
        return <input key={name} type="hidden" name={name} value={id} />;
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasUnpublishedChanges
            ? "You have unpublished draft changes."
            : "Draft matches the live header."}{" "}
          Row thumbs and right-rail promo photos. Choose / upload / capture,
          then <span className="font-medium text-foreground">Save draft</span>{" "}
          and <span className="font-medium text-foreground">Publish live</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {savePending ? "Saving…" : "Save draft"}
          </Button>
          <Button type="submit" formAction={publishAction} disabled={busy}>
            {publishPending ? "Publishing…" : "Publish live"}
          </Button>
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700">{state.message}</p>
      ) : null}

      {byMenu.map(({ menuLabel, items }) => (
        <section key={menuLabel} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{menuLabel}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((slot) => {
              const isCustom = Boolean(custom[slot.key]);
              const displayId = custom[slot.key] ?? slot.publicId ?? null;
              return (
                <SlotCard
                  key={slot.key}
                  slot={slot}
                  displayId={displayId}
                  isCustom={isCustom}
                  onPick={(intent) =>
                    setPicker({
                      key: slot.key,
                      folder: slot.uploadFolder,
                      intent,
                    })
                  }
                  onReset={() =>
                    setCustom((prev) => {
                      const next = { ...prev };
                      delete next[slot.key];
                      return next;
                    })
                  }
                />
              );
            })}
          </ul>
        </section>
      ))}

      <DeskStickyActionBar>
        <Button type="submit" disabled={busy}>
          {savePending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="submit" formAction={publishAction} disabled={busy}>
          {publishPending ? "Publishing…" : "Publish live"}
        </Button>
      </DeskStickyActionBar>

      <CloudinaryPicker
        open={picker != null}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        uploadFolder={picker?.folder ?? "pelbu/brand"}
        acceptVideo={false}
        initialTab={picker?.intent ? "upload" : "library"}
        uploadIntent={picker?.intent ?? null}
        title="Mega menu photo"
        description="Pick from the library, upload a file, or capture with the camera."
        onSelect={(id) => {
          if (picker) {
            setCustom((prev) => ({ ...prev, [picker.key]: id }));
          }
          setPicker(null);
        }}
      />
    </form>
  );
}
