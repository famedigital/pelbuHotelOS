import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { MediaCard } from "@/components/site/MediaCard";
import { Button } from "@/components/ui/button";
import { BRAND_CLOUDINARY } from "@/lib/brand";
import { loadCmsPage } from "@/lib/cms";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const SERVICES = [
  {
    href: "/rooms",
    title: "Rooms & suites",
    description: "Comfortable guest rooms and suites for Thimphu stays.",
    publicId: BRAND_CLOUDINARY.roomsDeluxe,
  },
  {
    href: "/restaurant",
    title: "Restaurant",
    description: "Bhutanese, Indian, and international dining.",
    publicId: BRAND_CLOUDINARY.restaurantPlate,
  },
  {
    href: "/bar",
    title: "Cafe & bar",
    description: "Coffee, drinks, snacks, and a place to unwind.",
    publicId: BRAND_CLOUDINARY.barPour,
  },
  {
    href: "/spa",
    title: "Spa & steam",
    description: "Treatments and steam sessions for recovery.",
    publicId: BRAND_CLOUDINARY.spaSteam,
  },
  {
    href: "/meeting",
    title: "Board room",
    description: "Meetings, workshops, and small conferences.",
    publicId: BRAND_CLOUDINARY.diningRoom,
  },
  {
    href: "/salon",
    title: "Salon",
    description: "Hair, nail, and personal-care appointments.",
    publicId: BRAND_CLOUDINARY.roomsLiving,
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("services");
  return {
    title: page?.seo_title ?? "Hotel Services | Pelbu Suites",
    description:
      page?.meta_description ??
      "Explore rooms, dining, cafe and bar, spa and steam, meetings, salon, and practical hotel services at Pelbu Suites in Thimphu.",
    alternates: { canonical: "/services" },
  };
}

export default async function ServicesPage() {
  const page = await loadCmsPage("services");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Services", path: "/services" },
            ]),
          ),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Services" },
        ]}
        eyebrow={page?.eyebrow ?? "Hotel services"}
        title={page?.title ?? "The useful parts of a Thimphu stay, together."}
        description={
          page?.body ??
          "From rooms and dining to recovery, meetings, and guest assistance, Pelbu Suites brings the practical parts of a stay under one roof."
        }
        actions={
          <>
            <Button asChild variant="citrus">
              <a href={page?.primary_cta_href ?? "/book"}>
                {page?.primary_cta_label ?? "Book a room"}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={page?.secondary_cta_href ?? "/contact"}>
                {page?.secondary_cta_label ?? "Contact the desk"}
              </a>
            </Button>
          </>
        }
      >
        <div className="space-y-10">
          <CmsContentSections sections={page?.sections_json} />
          <section>
            <h2 className="font-display text-2xl text-foreground">Top services</h2>
            <ul className="mt-6 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((service) => (
                <li key={service.href} className="h-full">
                  <MediaCard
                    href={service.href}
                    title={service.title}
                    description={service.description}
                    publicId={service.publicId}
                    ratio="4/3"
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </EngineShell>
    </>
  );
}
