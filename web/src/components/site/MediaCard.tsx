import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  title: string;
  description?: string;
  publicId?: string | null;
  src?: string | null;
  resourceType?: CloudinaryResourceType | string | null;
  posterPublicId?: string | null;
  ratio?: "16/10" | "4/3" | "1/1" | "3/2";
  badge?: ReactNode;
  meta?: ReactNode;
  className?: string;
  priority?: boolean;
};

/** Standard-ratio public card with motion-safe hover lift. */
export function MediaCard({
  href,
  title,
  description,
  publicId,
  src,
  resourceType = "image",
  posterPublicId,
  ratio = "4/3",
  badge,
  meta,
  className,
  priority,
}: Props) {
  return (
    <Card
      className={cn(
        "media-card h-full gap-0 border-0 py-0 shadow-none",
        className,
      )}
    >
      <Link href={href} className="group flex h-full flex-col">
        {(publicId || src) && (
          <div className="relative overflow-hidden">
            <CloudinaryMedia
              publicId={publicId}
              src={src}
              alt={title}
              resourceType={resourceType}
              posterPublicId={posterPublicId}
              ratio={ratio}
              priority={priority}
              cinematic={false}
              controls={false}
              active={false}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            {badge ? (
              <div className="absolute left-3 top-3 z-10">{badge}</div>
            ) : null}
          </div>
        )}
        {/* Fixed line boxes for title and blurb, meta pinned to the bottom:
            every card in a grid ends up the same height and the rows line up
            regardless of how long the copy is. */}
        <CardContent className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex min-h-14 items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-display text-xl leading-snug text-foreground transition-colors group-hover:text-sky-700">
              {title}
            </h3>
            <ArrowUpRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-700" />
          </div>
          <p className="line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          {meta ? <div className="mt-auto pt-3">{meta}</div> : null}
        </CardContent>
      </Link>
    </Card>
  );
}
