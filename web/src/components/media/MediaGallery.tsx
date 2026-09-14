"use client";

import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import type { CmsMediaItem } from "@/lib/cms";

type Props = {
  items: CmsMediaItem[];
  label?: string;
};

export function MediaGallery({ items, label = "Gallery" }: Props) {
  const visible = items.filter(
    (item) => item.src || item.public_id,
  );
  if (visible.length === 0) return null;

  const leadIndex = visible.findIndex((item) => item.kind === "gallery");
  const showLead = leadIndex >= 0 && visible.length >= 3;
  const lead = showLead ? visible[leadIndex] : null;
  const gridItems = showLead
    ? visible.filter((_, i) => i !== leadIndex)
    : visible;

  return (
    <section aria-label={label} className="space-y-5">
      <div>
        <p className="text-sm font-medium text-juniper">Gallery</p>
        <h2 className="mt-1 font-display text-2xl text-foreground">{label}</h2>
      </div>

      {lead ? (
        <div className="overflow-hidden rounded-2xl bg-secondary shadow-[0_24px_50px_-30px_rgba(18,26,23,0.4)]">
          <CloudinaryMedia
            publicId={lead.public_id}
            src={lead.src}
            alt={lead.alt || ""}
            resourceType={lead.resource_type}
            posterPublicId={lead.poster_public_id}
            ratio="16/9"
            cinematic={lead.resource_type === "video"}
            priority
            sizes="100vw"
          />
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {gridItems.map((item) => (
          <li
            key={item.id}
            className="overflow-hidden rounded-xl bg-secondary"
          >
            <CloudinaryMedia
              publicId={item.public_id}
              src={item.src}
              alt={item.alt || ""}
              resourceType={item.resource_type}
              posterPublicId={item.poster_public_id}
              ratio="4/3"
              cinematic={false}
              controls={item.resource_type === "video"}
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
