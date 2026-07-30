import { EngineShell } from "@/components/site/EngineShell";
import { loadGuidePosts } from "@/lib/public-content";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thimphu Stay Guide | Pelbu Suites",
  description:
    "Practical owned guides for planning a stay, meals, meetings, and arrival in Olakha and Thimphu.",
  alternates: { canonical: "/guide" },
};

export default async function GuideIndexPage() {
  const posts = await loadGuidePosts();

  return (
    <EngineShell
      eyebrow="Pelbu guide"
      title="Useful before you arrive."
      description="Practical notes from the hotel for planning a smoother stay in Olakha and Thimphu. Operational details are verified and dated in each guide."
    >
      {posts.length === 0 ? (
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          Guides are being verified before publication. See the FAQ for current
          booking and property answers.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <li
              key={post.slug}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {post.coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverSrc}
                  alt=""
                  width={720}
                  height={450}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : null}
              <div className="p-5">
                <h2 className="font-display text-xl text-ink">{post.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {post.excerpt}
                </p>
                <Link
                  href={`/guide/${post.slug}`}
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Read guide →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </EngineShell>
  );
}
