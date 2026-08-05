import { HomeHero } from "@/components/home/HomeHero";
import { HomeRooms } from "@/components/home/HomeRooms";
import { HomeStorySection } from "@/components/home/HomeStorySection";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { HOME_HERO_SLIDES } from "@/lib/brand";
import {
  cloudinaryHeroUrl,
  normalizeFocal,
} from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { loadHomeShowcase } from "@/lib/home-content";
import { loadHomepageStory, DEFAULT_HOMEPAGE_STORY } from "@/lib/home-story";
import { formatBtn } from "@/lib/pricing";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import { loadPublicRoomsWithRates } from "@/lib/public-room-rates";
import { safePublic } from "@/lib/public-safe";
import { staySecondaryCta } from "@/lib/stay-conversion";
import {
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

function digitsPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.replace(/\D/g, "");
  return d || null;
}

export default async function HomePage() {
  const [page, property, rateRooms, heroMedia, story, showcase] =
    await Promise.all([
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
      safePublic(
        "home-hero-media",
        () =>
          loadCmsGallery("home", 2400, {
            heroQuality: true,
          }),
        [],
      ),
      safePublic("home-story", () => loadHomepageStory(), DEFAULT_HOMEPAGE_STORY),
      safePublic("home-showcase", () => loadHomeShowcase(), {
        rooms: [],
        restaurant: [],
        cafe: [],
        pastry: [],
        counts: {
          rooms: 0,
          restaurant: 0,
          cafe: 0,
          pastry: 0,
          bar: 0,
          orderable: 0,
        },
      }),
    ]);

  const homepageStory = story;

  const desktopHero = heroMedia.filter(
    (item) => item.kind === "hero" && (item.src || item.public_id),
  );
  const mobileHero = heroMedia.filter(
    (item) => item.kind === "hero_mobile" && (item.src || item.public_id),
  );

  const slides = desktopHero.length
    ? desktopHero.map((item, i) => {
        const mobile =
          mobileHero[i] ??
          mobileHero[0] ??
          null;
        const focal = normalizeFocal(item.focal_x, item.focal_y);
        const mobileFocal = mobile
          ? normalizeFocal(mobile.focal_x, mobile.focal_y)
          : focal;
        // Always rebuild retina crop URLs so the loader has a real w×h aspect
        // (cms `src` alone is often width-only and re-cuts soft).
        const desktopSrc =
          item.resource_type === "video"
            ? (item.src ?? undefined)
            : cloudinaryHeroUrl(item.public_id, {
                width: 3840,
                height: 2160,
                crop: "fill",
                gravity: focal,
              }) ?? item.src ?? undefined;

        const mobileSrc =
          (mobile?.resource_type === "video" ? mobile.src : null) ??
          (item.resource_type === "image" || !item.resource_type
            ? cloudinaryHeroUrl(mobile?.public_id ?? item.public_id, {
                width: 1440,
                height: 2560,
                crop: "fill",
                gravity: mobileFocal,
              })
            : item.src);

        return {
          publicId: item.public_id,
          alt: item.alt || "Pelbu Suites",
          label: heroLabel(item.alt, "Pelbu Suites"),
          src: desktopSrc,
          resourceType: item.resource_type,
          posterPublicId: item.poster_public_id,
          mobilePublicId: mobile?.public_id ?? item.public_id,
          mobileSrc: mobileSrc ?? undefined,
        };
      })
    : HOME_HERO_SLIDES.map((slide) => ({
        ...slide,
        resourceType: "image" as const,
        src:
          cloudinaryHeroUrl(slide.publicId, {
            width: 3840,
            height: 2160,
            crop: "fill",
            gravity: "auto",
          }) ?? undefined,
        mobileSrc:
          cloudinaryHeroUrl(slide.publicId, {
            width: 1440,
            height: 2560,
            crop: "fill",
            gravity: "auto",
          }) ?? undefined,
        mobilePublicId: slide.publicId,
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

  const waDigits = digitsPhone(property?.whatsapp ?? property?.phone);
  const lunch = homepageStory.lunch;
  const lunchWa =
    waDigits && lunch.amount_btn != null
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          `Hello Pelbu Suites — we would like to schedule a lunch package (BTN ${lunch.amount_btn} pp) for our guests.`,
        )}`
      : lunch.primary_href;

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

        <HomeStorySection
          id="about"
          block={homepageStory.about}
        />

        {homepageStory.rooms.enabled ? (
          <HomeRooms
            rooms={rateRooms.rooms}
            seasonName={rateRooms.seasonName}
            taxInclusive={rateRooms.taxInclusive}
            eyebrow={homepageStory.rooms.eyebrow}
            title={homepageStory.rooms.title}
            description={homepageStory.rooms.body}
          />
        ) : null}

        <HomeStorySection
          id="restaurant"
          block={homepageStory.restaurant}
          reverse
          menuItems={showcase.restaurant}
        />

        <HomeStorySection
          id="lunch"
          block={{
            ...lunch,
            primary_href: lunchWa,
            primary_label: lunch.primary_label || "Schedule lunch",
          }}
        />

        <HomeStorySection
          id="cafe"
          block={homepageStory.cafe}
          reverse
          menuItems={[...showcase.cafe, ...showcase.pastry].slice(0, 6)}
        />

        <HomeStorySection id="spa" block={homepageStory.spa} />
      </main>
      <SiteFooter profile={property} />
    </>
  );
}
