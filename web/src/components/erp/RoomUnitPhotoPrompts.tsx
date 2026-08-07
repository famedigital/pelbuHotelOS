"use client";

import {
  addPropertyMedia,
  type PropertyMediaState,
} from "@/app/actions/erp-property-media";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/cloudinary-direct-upload";
import {
  ROOM_FACET_LABELS,
  type RoomMediaFacet,
} from "@/lib/property-media";
import { ROOM_MAP_CORE_FACETS } from "@/components/erp/room-map-shared";
import { CameraIcon, ImagePlusIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";

type UnitPhoto = {
  id: string;
  facet: string;
  public_id: string;
};

type Props = {
  unitId: string;
  unitLabel: string;
  unitPhotos: UnitPhoto[];
  typePhotoPublicIds: string[];
  onUploaded: () => void;
};

/**
 * Core facet checklist for a physical room — prompt to camera/gallery upload.
 */
export function RoomUnitPhotoPrompts({
  unitId,
  unitLabel,
  unitPhotos,
  typePhotoPublicIds,
  onUploaded,
}: Props) {
  const byFacet = new Map<string, UnitPhoto>();
  for (const p of unitPhotos) {
    if (!byFacet.has(p.facet)) byFacet.set(p.facet, p);
  }

  const missing = ROOM_MAP_CORE_FACETS.filter((f) => !byFacet.has(f));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Room {unitLabel}: photograph each area once. Phone camera or gallery —
        photos attach to this physical unit (not only the room type).
      </p>

      {missing.length > 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground">
          {missing.length} area{missing.length === 1 ? "" : "s"} still need a
          photo:{" "}
          {missing
            .map((f) => ROOM_FACET_LABELS[f as RoomMediaFacet] ?? f)
            .join(", ")}
        </p>
      ) : (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
          Core five photos complete for this room.
        </p>
      )}

      <ul className="space-y-3">
        {ROOM_MAP_CORE_FACETS.map((facet) => {
          const existing = byFacet.get(facet);
          const label = ROOM_FACET_LABELS[facet as RoomMediaFacet] ?? facet;
          return (
            <li
              key={facet}
              className="flex gap-3 rounded-lg border bg-card p-2.5"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {existing ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      cloudinaryUrl(existing.public_id, {
                        width: 160,
                        height: 160,
                        crop: "fill",
                      }) ?? undefined
                    }
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <CameraIcon className="size-5 opacity-50" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {existing
                    ? "Replace or keep — primary inventory shot for this area."
                    : "Missing — open camera or pick from gallery."}
                </p>
                <FacetUploadControls
                  unitId={unitId}
                  facet={facet}
                  onUploaded={onUploaded}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {typePhotoPublicIds.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Room-type reference
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {typePhotoPublicIds.slice(0, 6).map((id) => {
              const src = cloudinaryUrl(id, { width: 200, height: 140, crop: "fill" });
              if (!src) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={src}
                  alt=""
                  className="aspect-[4/3] w-full rounded-md object-cover"
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FacetUploadControls({
  unitId,
  facet,
  onUploaded,
}: {
  unitId: string;
  facet: string;
  onUploaded: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadToCloudinary(file, {
        folder: `pelbu/trust/room_unit/${facet}`,
        imageOnly: true,
      });
      const fd = new FormData();
      fd.set("scope", "room_unit");
      fd.set("scope_id", unitId);
      fd.set("facet", facet);
      fd.set("public_id", uploaded.publicId);
      fd.set("resource_type", "image");
      fd.set("is_primary", facet === "overview" ? "on" : "");
      fd.set("is_published", "");
      if (uploaded.width) fd.set("width", String(uploaded.width));
      if (uploaded.height) fd.set("height", String(uploaded.height));
      if (uploaded.bytes) fd.set("bytes", String(uploaded.bytes));
      if (uploaded.format) fd.set("format", uploaded.format);
      const result: PropertyMediaState = await addPropertyMedia(
        { ok: false },
        fd,
      );
      if (!result.ok) {
        throw new Error(result.error ?? "Could not save photo.");
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <CameraIcon className="size-3.5" />
          )}
          Camera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlusIcon className="size-3.5" />
          Gallery
        </Button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
