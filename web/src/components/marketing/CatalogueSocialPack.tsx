"use client";

import { recordCatalogueSocialDlAction } from "@/app/actions/erp-catalogues";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { CatalogueResolvedContent } from "@/lib/marketing/catalogue";
import { SOCIAL_CROP_PRESETS } from "@/lib/marketing/catalogue-templates";

export function CatalogueSocialPack({
  content,
}: {
  content: CatalogueResolvedContent;
}) {
  const publicId =
    content.coverPublicId ||
    content.rooms.find((r) => r.imagePublicId)?.imagePublicId ||
    content.menuItems.find((m) => m.imagePublicId)?.imagePublicId ||
    content.gallery[0]?.publicId ||
    null;

  if (!publicId) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a cover or media image to generate social crops.
      </p>
    );
  }

  const trackDl = () => {
    void recordCatalogueSocialDlAction(content.catalogue.id);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Open full size, then save for Meta posts. Crops via Cloudinary.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_CROP_PRESETS.map((preset) => {
          const src = cloudinaryUrl(publicId, {
            width: preset.width,
            height: preset.height,
            crop: "fill",
          });
          if (!src) return null;
          return (
            <li key={preset.key} className="space-y-1.5 rounded-lg border p-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                {preset.label} · {preset.width}×{preset.height}
              </p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackDl}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={preset.label}
                  className="mx-auto max-h-40 w-auto object-contain"
                />
              </a>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackDl}
                className="block text-center text-xs text-sky-600 underline-offset-2 hover:underline"
              >
                Open full size
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
