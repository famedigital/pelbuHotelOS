import { HomeAgents } from "@/components/home/HomeAgents";
import { HomeFaqTeaser } from "@/components/home/HomeFaqTeaser";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeInHouse } from "@/components/home/HomeInHouse";
import { HomeProof } from "@/components/home/HomeProof";
import { HomeRooms } from "@/components/home/HomeRooms";
import { HomeTrustStrip } from "@/components/home/HomeTrustStrip";
import { HomeWhy } from "@/components/home/HomeWhy";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { HOME_HERO_SLIDES } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { formatBtn } from "@/lib/pricing";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import { loadPublicRoomsWithRates } from "@/lib/public-room-rates";
import { safePublic } from "@/lib/public-safe";
import { staySecondaryCta } from "@/lib/stay-conversion";
import {
  faqJsonLd,
  hotelJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/structured-data";
import { shareSocialMeta } from "@/lib/og-share";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await safePublic("home-meta", () => loadCmsPage("home"), null);
  const title =
    page?.seo_title ?? "Pelbu Suites Olakha | Hotel in Thimphu, Bhutan";
  const description =
    page?.meta_description ??
    "Book rooms direct at Pelbu Suites in Olakha, Thimphu — cafe, restaurant, spa and meeting under one roof.";
  const social = shareSocialMeta({
    title: page?.seo_title ?? "Pelbu Suites Olakha | Hotel in Thimphu",
    description:
      page?.meta_description ??
      "A calm Olakha base for stays, meals and recovery — direct rates, live availability.",
    path: "/",
    publicId: page?.og_public_id,
    alt: "Pelbu Suites hotel in Olakha, Thimphu",
  });

  return {
    title,
    description,
    alternates: { canonical: "/" },
    ...social,
  };
}

/** Alt text doubles as the on-slide caption, so keep the leading phrase short. */
function heroLabel(alt: string, fallback: string): string {
  const lead = alt.split(/[—,·|]/)[0]?.trim();
  return lead && lead.length <= 40 ? lead : fallback;
}

export default async function HomePage() {
  const [page, property, rateRooms, heroMedia, faqPage] = await Promise.all([
    safePublic("home-cms", () => loadCmsPage("home"), null),
    safePublic("home-property", () => loadPublicPropertyProfile(), null),
    safePublic(
      "home-rooms-rates",
      () => loadPublicRoomsWithRates(),
      {
        rooms: [],
        lowestFromBtn: null,
        seasonKind: null,
        seasonName: null,
        taxInclusive: false,
      },
    ),
    safePublic("home-hero-media", () => loadCmsGallery("home", 2400), []),
    safePublic("home-faq", () => loadCmsPage("faq"), null),
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

  const sameAs = [
    property?.facebook,
    property?.instagram,
    property?.tiktok,
    property?.mapsUrl,
  ].filter((v): v is string => Boolean(v));

  const priceRange =
    rateRooms.lowestFromBtn != null
      ? `${formatBtn(rateRooms.lowestFromBtn)}+`
      : null;

  const secondary = staySecondaryCta(page);
  const faqItems = faqPage?.faq_json ?? [];
  const ratesMissing =
    rateRooms.rooms.length === 0 ||
    rateRooms.rooms.every((r) => r.fromPriceBtn == null);

  const jsonLd = [
    hotelJsonLd({
      image: slides[0]?.src,
      telephone: property?.phone,
      email: property?.email,
      address: property?.address,
      mapsUrl: property?.mapsUrl,
      latitude: property?.latitude,
      longitude: property?.longitude,
      checkInTime: property?.checkInTime,
      checkOutTime: property?.checkOutTime,
      starRating: property?.starRating,
      roomCount: property?.roomCount,
      priceRange,
      sameAs,
      amenities: property?.amenities,
      roomOffers: rateRooms.rooms
        .filter(
          (r): r is typeof r & { fromPriceBtn: number } =>
            r.fromPriceBtn != null && r.fromPriceBtn > 0,
        )
        .map((r) => ({
          name: r.name,
          path: `/rooms/${r.slug}`,
          priceBtn: r.fromPriceBtn,
          image: r.imageSrc,
        })),
    }),
    websiteJsonLd(),
  ];
  if (faqItems.length > 0) {
    jsonLd.push(faqJsonLd(faqItems));
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(jsonLd),
        }}
      />
      <PublicSiteHeader variant="hero" heroTheme={page?.hero_theme} />
      <main>
        <HomeHero
          slides={slides}
          eyebrow={page?.eyebrow ?? "Olakha · Thimphu · Bhutan"}
          title={
            page?.title ??
            "Hotel in Olakha — stay close to the city, come home to calm."
          }
          description={
            page?.body ??
            "Quiet rooms at Pelbu Suites with direct rates, live availability, and cafe, restaurant and spa under one roof in Thimphu."
          }
          secondaryHref={secondary.href}
          secondaryLabel={secondary.label}
          fromPriceBtn={rateRooms.lowestFromBtn}
          taxInclusive={rateRooms.taxInclusive}
          theme={page?.hero_theme}
        />

        <HomeTrustStrip
          property={property}
          fromPriceBtn={rateRooms.lowestFromBtn}
          seasonName={rateRooms.seasonName}
          taxInclusive={rateRooms.taxInclusive}
          ratesMissing={ratesMissing}
        />

        <HomeProof />

        <HomeRooms
          rooms={rateRooms.rooms}
          seasonName={rateRooms.seasonName}
          taxInclusive={rateRooms.taxInclusive}
        />

        <HomeWhy />

        <HomeInHouse />

        <HomeFaqTeaser items={faqItems} />

        {page?.sections_json?.length ? (
          <section className="bg-gradient-to-b from-background to-sky-50/50 px-5 py-12 md:px-8 md:py-16">
            <CmsContentSections
              sections={page.sections_json}
              className="mx-auto max-w-[1120px]"
            />
          </section>
        ) : null}

        <HomeAgents />
      </main>
      <SiteFooter profile={property} />
    </>
  );
}
