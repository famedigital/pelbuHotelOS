"use client";

import { tryMetaGraphPost, type MarketingState } from "@/app/actions/erp-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import Link from "next/link";
import { useActionState, useState } from "react";

const initial: MarketingState = { ok: false };

export function MarketingShareHub({
  catalogueLinks,
  campaigns,
  graphEnabled,
  siteUrl,
}: {
  catalogueLinks: { id: string; title: string; publicPath: string }[];
  campaigns: { id: string; name: string }[];
  graphEnabled: boolean;
  siteUrl: string;
}) {
  const [caption, setCaption] = useState(
    "Stay above Thimphu at Pelbu Suites Olakha — suites, cafe & calm Himalayan light.",
  );
  const [link, setLink] = useState(siteUrl);
  const [state, action, pending] = useActionState(tryMetaGraphPost, initial);
  useActionToast(state, { successMessage: "Posted to Facebook Page" });

  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  const igCaption = [caption, link].filter(Boolean).join("\n\n");

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          Share / Meta pack
        </p>
        <p className="text-sm text-muted-foreground">
          Full Graph auto-post needs Meta App Review. Without tokens you can
          still compose captions, open Facebook&apos;s share dialog, copy for
          Instagram, and download catalogue social crops. Log post URLs on the
          Campaign form for ROI.
        </p>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">Link to share</span>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="h-10"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-700"
            onClick={() => void navigator.clipboard?.writeText(igCaption)}
          >
            Copy IG caption + link
          </button>
          <a
            href={fbShare}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
          >
            Open Facebook sharer
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
          >
            Open Instagram
          </a>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold">Catalogue social packs</p>
        {catalogueLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Publish a catalogue first — social crop downloads live on{" "}
            <Link href="/erp/marketing?tab=catalogues" className="underline">
              Catalogues
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {catalogueLinks.map((c) => (
              <li key={c.id}>
                <a
                  href={c.publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline-offset-2 hover:underline"
                >
                  {c.title}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  open page → social pack crops
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold">
          Page Graph post{" "}
          {graphEnabled ? (
            <span className="text-xs font-normal text-emerald-700">
              · tokens detected
            </span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">
              · set FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID later
            </span>
          )}
        </p>
        {graphEnabled ? (
          <form action={action} className="space-y-3">
            <input type="hidden" name="caption" value={caption} />
            <input type="hidden" name="link" value={link} />
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Attach campaign</span>
              <select
                name="campaign_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            {state.message ? (
              <p className="text-sm text-emerald-700">{state.message}</p>
            ) : null}
            <Button type="submit" disabled={pending} className="h-10">
              {pending ? "Posting…" : "Post to Facebook Page"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            After Meta App Review, add Page tokens in the server env (never
            commit). Until then, use the share dialog + campaign Meta URL fields
            for tracking.
          </p>
        )}
      </div>
    </div>
  );
}
