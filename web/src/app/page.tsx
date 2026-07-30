import { HomeAgents } from "@/components/home/HomeAgents";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeMarketplace } from "@/components/home/HomeMarketplace";
import { HomeOutletSection } from "@/components/home/HomeOutletSection";
import { HomeRooms } from "@/components/home/HomeRooms";
import { HomeWhy } from "@/components/home/HomeWhy";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { BRAND_ICONS, HOME_HERO_SLIDES, OUTLET_SHOWCASE_PHOTOS } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { loadHomeShowcase } from "@/lib/home-content";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import {
  hotelJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const HERO_PRODUCTS = [
  { href: "/rooms", label: "Rooms", hint: "Stay" },
  { href: "/restaurant", label: "Restaurant", hint: "Dinner" },
  { href: "/cafe", label: "Cafe", hint: "From 6:30" },
  { href: "/menu?outlet=pastry", label: "Pastry", hint: "Fresh daily" },
  { href: "/menu", label: "Order online", hint: "Pickup or taxi" },
  { href: "/spa", label: "Spa & steam", hint: "Recover" },
  { href: "/meeting", label: "Meeting", hint: "Host" },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("home");
  return {
    title: page?.seo_title ?? "Pelbu Suites Olakha | Hotel in Thimphu",
    description:
      page?.meta_description ??
      "Stay, dine, meet, and recover at Pelbu Suites in Olakha, Thimphu.",
    alternates: { canonical: "/" },
    openGraph: {
      title: page?.seo_title ?? "Pelbu Suites Olakha",
      description:
        page?.meta_description ??
        "A practical, warm base in Olakha for stays, meals, meetings, and recovery.",
      type: "website",
      url: "/",
    },
  };
}

/** Alt text doubles as the on-slide caption, so keep the leading phrase short. */
function heroLabel(alt: string, fallback: string): string {
  const lead = alt.split(/[—,·|]/)[0]?.trim();
  return lead && lead.length <= 40 ? lead : fallback;
}

export default async function HomePage() {
  const [page, property, showcase, cafePage, restaurantPage, heroMedia] =
    await Promise.all([
      loadCmsPage("home"),
      loadPublicPropertyProfile(),
      loadHomeShowcase(),
      loadCmsPage("cafe"),
      loadCmsPage("restaurant"),
      loadCmsGallery("home", 2400),
    ]);

  const cmsHero = heroMedia.filter(
    (item) => item.kind === "hero" && (item.src || item.public_id),
  );
  const slides = cmsHero.length
    ? cmsHero.map((item) => ({
        publicId: item.public_id,
        alt: item.alt || "Pelbu Suites",
        label: heroLabel(item.alt, "Pelbu Suites"),
        src: item.src ?? undefined,
        resourceType: item.resource_type,
        posterPublicId: item.poster_public_id,
      }))
    : HOME_HERO_SLIDES.map((slide) => ({
        ...slide,
        resourceType: "image" as const,
        src:
          cloudinaryUrl(slide.publicId, {
            width: 2400,
            crop: "fill",
          }) ?? undefined,
      }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            hotelJsonLd({
              image: slides[0]?.src,
              telephone: property?.phone,
              email: property?.email,
              address: property?.address,
            }),
            websiteJsonLd(),
          ]),
        }}
      />
      <PublicSiteHeader logoSrc={BRAND_ICONS.mark} variant="hero" />
      <main>
        <HomeHero
          slides={slides}
          eyebrow={page?.eyebrow ?? "Olakha · Thimphu · Bhutan"}
          title={page?.title ?? "Stay close to the city. Come home to calm."}
          description={
            page?.body ??
            "Rooms, a cafe that opens before the city does, a multicuisine restaurant, fresh pastry, and an online kitchen that delivers across Thimphu."
          }
          secondaryHref={page?.secondary_cta_href ?? "/menu"}
          secondaryLabel={page?.secondary_cta_label ?? "Order food online"}
          products={HERO_PRODUCTS}
        />

        <HomeRooms rooms={showcase.rooms} />

        <HomeOutletSection
          id="restaurant"
          eyebrow="Restaurant"
          title="Indian, Bhutanese and multicuisine."
          description={
            restaurantPage?.body ??
            "Breakfast, lunch and dinner cooked to order, with signature plates you will not find on every Thimphu corner."
          }
          note={restaurantPage?.hours_note}
          photos={[...OUTLET_SHOWCASE_PHOTOS.restaurant]}
          items={showcase.restaurant}
          accent="sky"
          primary={{ href: "/menu?outlet=restaurant", label: "Order from the kitchen" }}
          secondary={{ href: "/restaurant", label: "Restaurant page" }}
        />

        <HomeOutletSection
          id="cafe"
          eyebrow="Cafe"
          title="Coffee before the city wakes up."
          description={
            cafePage?.body ??
            "Breakfast, espresso and all-day plates from early morning — eat in, collect at the counter, or send it by taxi."
          }
          note={cafePage?.hours_note}
          photos={[...OUTLET_SHOWCASE_PHOTOS.cafe]}
          items={showcase.cafe}
          accent="citrus"
          reverse
          primary={{ href: "/menu?outlet=cafe", label: "Order cafe items" }}
          secondary={{ href: "/cafe", label: "Cafe page" }}
        />

        <HomeOutletSection
          id="pastry"
          eyebrow="Pastry"
          title="Baked in-house, sold until it runs out."
          description="Croissants, cakes and Bhutanese-favourite bakes from our own pastry section — perfect for an office run or a gift box."
          photos={[...OUTLET_SHOWCASE_PHOTOS.pastry]}
          items={showcase.pastry}
          accent="mint"
          primary={{ href: "/menu?outlet=pastry", label: "See today’s pastry" }}
          secondary={{ href: "/menu", label: "Full menu" }}
        />

        <HomeMarketplace dishCount={showcase.counts.orderable} />

        <HomeAgents />

        <section className="bg-gradient-to-b from-background to-sky-50/50 px-5 py-16 md:px-8 md:py-20">
          <CmsContentSections
            sections={page?.sections_json}
            className="mx-auto max-w-[1120px]"
          />
        </section>

        <HomeWhy />
      </main>
      <SiteFooter profile={property} />
    </>
  );
}
