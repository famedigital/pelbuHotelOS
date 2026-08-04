"use client";

export function CatalogueShareBar({
  shareUrl,
  caption,
  hashtags,
  facebookUrl,
  instagramUrl,
}: {
  shareUrl: string;
  caption: string | null;
  hashtags: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}) {
  const text = [caption, hashtags, shareUrl].filter(Boolean).join("\n\n");
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

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
        <a
          href={fbShare}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
        >
          Facebook share
        </a>
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
