import { PublicAnswerPage } from "@/components/site/PublicAnswerPage";
import { loadCmsPage } from "@/lib/cms";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("faq");
  return {
    title: page?.seo_title ?? "Pelbu Suites FAQ",
    description:
      page?.meta_description ??
      "Practical answers for booking and visiting Pelbu Suites in Olakha.",
    alternates: { canonical: page?.canonical_path ?? "/faq" },
  };
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
