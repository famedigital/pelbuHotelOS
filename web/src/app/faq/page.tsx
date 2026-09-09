import { PublicAnswerPage } from "@/components/site/PublicAnswerPage";
import { loadCmsPage } from "@/lib/cms";
import { PAGE_SEO, metadataFromCms } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicMarketingCache } from "@/lib/public-marketing-cache";
const __pelbuPubCache = publicMarketingCache();
export const dynamic = __pelbuPubCache.dynamic;
export const revalidate = __pelbuPubCache.revalidate;


export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("faq");
  return metadataFromCms(page, {
    title: PAGE_SEO.faq.title,
    description: PAGE_SEO.faq.description,
    path: "/faq",
  });
}

export default async function FaqPage() {
  const page = await loadCmsPage("faq");
  if (!page) notFound();

  return (
    <PublicAnswerPage
      page={page}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "FAQ", path: "/faq" },
      ]}
    />
  );
}
