"use client";

import { catalogueShareUrl } from "@/lib/marketing/catalogue-share";

export function CatalogueShareBar({
  slug,
  shareUrl,
  caption,
  hashtags,
  facebookUrl,
  instagramUrl,
  qrDataUrl,
}: {
  /** Catalogue slug for UTM variants */
  slug: string;
  /** Canonical share URL (with optional UTM) */
  shareUrl: string;
  caption: string | null;
  hashtags: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  qrDataUrl?: string | null;
}) {
  const igUrl = catalogueShareUrl(slug, "instagram");
  const fbUrl = catalogueShareUrl(slug, "facebook");
  const text = [caption, hashtags, shareUrl].filter(Boolean).join("\n\n");
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fbUrl)}`;

  return (
    <div className="print:hidden space-y-3 rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
        Share for Instagram & Facebook
      </p>
      <p className="break-all font-mono text-sm text-muted-foreground">
        {shareUrl}
      </p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={shareUrl} label="Copy link" />
        <CopyButton text={text} label="Copy caption + link" />
        {hashtags ? (
          <CopyButton text={hashtags} label="Copy hashtags" />
        ) : null}
        <ShareNativeButton title="Catalogue" text={text} url={shareUrl} />
        <a
          href={fbShare}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
        >
          Facebook share
        </a>
        <CopyButton text={igUrl} label="Copy IG UTM link" />
        {instagramUrl ? (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
          >
            Open Instagram profile
          </a>
        ) : null}
        {facebookUrl ? (
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
          >
            Hotel Facebook page
          </a>
        ) : null}
      </div>
      {caption ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{caption}</p>
      ) : null}
      {hashtags ? <p className="text-sm text-sky-700">{hashtags}</p> : null}
      {qrDataUrl ? (
        <div className="flex items-center gap-3 border-t pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Catalogue QR"
            className="size-24 rounded-md border bg-white p-1"
          />
          <p className="text-xs text-muted-foreground">
            Lobby / table tent QR → public catalogue (utm_source=qr).
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center rounded-md bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-700"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
      }}
    >
      {label}
    </button>
  );
}

function ShareNativeButton({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.share) {
          void navigator.share({ title, text, url }).catch(() => undefined);
        } else {
          void navigator.clipboard?.writeText(url);
        }
      }}
    >
      Device share
    </button>
  );
}
