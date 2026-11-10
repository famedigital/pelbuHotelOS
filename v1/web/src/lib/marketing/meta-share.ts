/**
 * Meta / social helpers that work without Meta App Review.
 * Full Page Graph auto-post only when FACEBOOK_PAGE_ACCESS_TOKEN is set.
 */

export type MetaTokenConfig = {
  pageAccessToken: string | null;
  pageId: string | null;
  graphEnabled: boolean;
};

export function getMetaTokenConfig(): MetaTokenConfig {
  const pageAccessToken =
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() ||
    process.env.META_PAGE_ACCESS_TOKEN?.trim() ||
    null;
  const pageId =
    process.env.FACEBOOK_PAGE_ID?.trim() ||
    process.env.META_PAGE_ID?.trim() ||
    null;
  return {
    pageAccessToken,
    pageId,
    graphEnabled: Boolean(pageAccessToken && pageId),
  };
}

/** Facebook web share dialog — no app / review required. */
export function facebookShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
}

/**
 * Optional Graph API feed post. Returns null when tokens unset.
 * Requires FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID (not committed).
 */
export async function postFacebookPageFeed(args: {
  message: string;
  link?: string | null;
}): Promise<
  | { ok: true; postId: string }
  | { ok: false; error: string; skipped?: boolean }
> {
  const cfg = getMetaTokenConfig();
  if (!cfg.graphEnabled || !cfg.pageAccessToken || !cfg.pageId) {
    return {
      ok: false,
      skipped: true,
      error:
        "Graph post not configured. Set FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID after Meta App Review, or use Share hub (Facebook sharer).",
    };
  }

  const body = new URLSearchParams();
  body.set("message", args.message);
  if (args.link) body.set("link", args.link);
  body.set("access_token", cfg.pageAccessToken);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
      },
    );
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      return {
        ok: false,
        error: json.error?.message ?? `Graph API ${res.status}`,
      };
    }
    return { ok: true, postId: json.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Graph request failed",
    };
  }
}
