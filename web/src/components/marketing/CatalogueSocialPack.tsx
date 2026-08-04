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

  const crops = SOCIAL_CROP_PRESETS.map((preset) => {
    const src = cloudinaryUrl(publicId, {
      width: preset.width,
      height: preset.height,
      crop: "fill",
    });
    return { ...preset, src };
  }).filter((c): c is (typeof c & { src: string }) => Boolean(c.src));

  const trackDl = () => {
    void recordCatalogueSocialDlAction(content.catalogue.id);
  };

  const allUrls = crops
    .map((c) => `${c.label} (${c.width}×${c.height})\n${c.src}`)
    .join("\n\n");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Open full size, then save for Meta posts. Crops via Cloudinary.
        </p>
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-700"
          onClick={() => {
            trackDl();
            void navigator.clipboard?.writeText(allUrls);
          }}
        >
          Copy all crop URLs
        </button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {crops.map((preset) => (
          <li key={preset.key} className="space-y-1.5 rounded-lg border p-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              {preset.label} · {preset.width}×{preset.height}
            </p>
            <a
              href={preset.src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackDl}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preset.src}
                alt={preset.label}
                className="mx-auto max-h-40 w-auto object-contain"
              />
            </a>
            <div className="flex justify-center gap-3 text-xs">
              <a
                href={preset.src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackDl}
                className="text-sky-600 underline-offset-2 hover:underline"
              >
                Open full size
              </a>
              <button
                type="button"
                className="text-sky-600 underline-offset-2 hover:underline"
                onClick={() => {
                  trackDl();
                  void navigator.clipboard?.writeText(preset.src!);
                }}
              >
                Copy URL
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
