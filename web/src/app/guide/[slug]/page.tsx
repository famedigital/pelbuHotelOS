import { MarkdownArticle } from "@/components/site/MarkdownArticle";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { loadGuidePost } from "@/lib/public-content";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadGuidePost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Pelbu Suites Guide`,
    description: post.metaDescription ?? post.excerpt,
    alternates: { canonical: `/guide/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.metaDescription ?? post.excerpt,
      url: `/guide/${post.slug}`,
      type: "article",
      images: post.coverSrc ? [{ url: post.coverSrc }] : undefined,
    },
  };
}

export default async function GuidePostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadGuidePost(slug);
  if (!post) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Guide", path: "/guide" },
              { name: post.title, path: `/guide/${post.slug}` },
            ]),
            articleJsonLd({
              title: post.title,
              description: post.metaDescription ?? post.excerpt,
              path: `/guide/${post.slug}`,
              image: post.coverSrc,
              publishedAt: post.publishedAt,
              updatedAt: post.updatedAt,
              authorName: post.authorName,
            }),
          ]),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Guide", path: "/guide" },
          { name: post.title },
        ]}
        eyebrow="Pelbu guide"
        title={post.title}
        description={post.excerpt}
        actions={
          <Button asChild variant="outline">
            <Link href="/guide">All guides</Link>
          </Button>
        }
      >
        {post.coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverSrc}
            alt=""
            width={1400}
            height={850}
            className="mx-auto mb-10 aspect-[16/9] max-w-4xl rounded-2xl object-cover"
          />
        ) : null}
        <MarkdownArticle markdown={post.bodyMd} />
        <p className="mx-auto mt-10 max-w-3xl border-t border-border pt-5 text-xs text-muted-foreground">
          Updated{" "}
          {new Date(post.updatedAt).toLocaleDateString("en-BT", {
            timeZone: "Asia/Thimphu",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          . Confirm time-sensitive details with the desk.
        </p>
      </EngineShell>
    </>
  );
}
