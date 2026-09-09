import { HomeAgents } from "@/components/home/HomeAgents";
import { HomeFaqTeaser } from "@/components/home/HomeFaqTeaser";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeInHouse } from "@/components/home/HomeInHouse";
import { HomeProof } from "@/components/home/HomeProof";
import { HomeRooms } from "@/components/home/HomeRooms";
import { HomeStorySection } from "@/components/home/HomeStorySection";
import { HomeTrustStrip } from "@/components/home/HomeTrustStrip";
import { HomeWhy } from "@/components/home/HomeWhy";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { HOME_HERO_SLIDES } from "@/lib/brand";
import {
  cloudinaryHeroUrl,
  normalizeFocal,
} from "@/lib/cloudinary";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { loadHomeShowcase } from "@/lib/home-content";
import {
  loadHomepageStory,
  DEFAULT_HOMEPAGE_STORY,
} from "@/lib/home-story";
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
import { PAGE_SEO, metadataFromCms } from "@/lib/seo";
import type { Metadata } from "next";

/** ISR — Next requires a static literal (not a helper return). */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const page = await safePublic("home-meta", () => loadCmsPage("home"), null);
  return metadataFromCms(page, {
    title: PAGE_SEO.home.title,
    description: PAGE_SEO.home.description,
    path: "/",
  });
}

function heroLabel(alt: string, fallback: string): string {
  const lead = alt.split(/[—,·|]/)[0]?.trim();
  return lead && lead.length <= 40 ? lead : fallback;
}

function digitsPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.replace(/\D/g, "");
  return d || null;
}

/**
 * Conversion spine (aabdcaa) + optional ERP story bands:
 * Hero → Trust → Proof → [About] → Rooms → Why → In-house →
 * [Restaurant / Lunch / Cafe / Spa deep-dives] → FAQ → Agents
 */
export default async function HomePage() {
  const [page, property, rateRooms, heroMedia, story, showcase, faqPage] =
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
      safePublic("home-faq", () => loadCmsPage("faq"), null),
    ]);

  const homepageStory = story;
  const funnel = homepageStory.funnel;
  const faqItems = faqPage?.faq_json ?? [];
  const ratesMissing =
    rateRooms.rooms.length === 0 ||
    rateRooms.rooms.every((r) => r.fromPriceBtn == null);

  const desktopHero = heroMedia.filter(
    (item) => item.kind === "hero" && (item.src || item.public_id),
  );
  const mobileHero = heroMedia.filter(
    (item) => item.kind === "hero_mobile" && (item.src || item.public_id),
  );

  const slides = desktopHero.length
    ? desktopHero.map((item, i) => {
        const mobile = mobileHero[i] ?? mobileHero[0] ?? null;
        const focal = normalizeFocal(item.focal_x, item.focal_y);
        const mobileFocal = mobile
          ? normalizeFocal(mobile.focal_x, mobile.focal_y)
          : focal;
        const desktopSrc =
          item.resource_type === "video"
            ? (item.src ?? undefined)
            : i === 0
              ? cloudinaryHeroUrl(item.public_id, {
                  width: 2400,
                  crop: "limit",
                }) ??
                item.src ??
                undefined
              : item.src ?? undefined;

        const mobileSrc =
          (mobile?.resource_type === "video" ? mobile.src : null) ??
          (item.resource_type === "image" || !item.resource_type
            ? i === 0
              ? cloudinaryHeroUrl(mobile?.public_id ?? item.public_id, {
                  width: 1200,
                  crop: "limit",
                })
              : null
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
          focalX: focal.x,
          focalY: focal.y,
          mobileFocalX: mobileFocal.x,
          mobileFocalY: mobileFocal.y,
        };
      })
    : HOME_HERO_SLIDES.map((slide, i) => ({
        ...slide,
        resourceType: "image" as const,
        src:
          i === 0
            ? cloudinaryHeroUrl(slide.publicId, {
                width: 2400,
                crop: "limit",
              }) ?? undefined
            : undefined,
        mobileSrc:
          i === 0
            ? cloudinaryHeroUrl(slide.publicId, {
                width: 1200,
                crop: "limit",
              }) ?? undefined
            : undefined,
        mobilePublicId: slide.publicId,
        focalX: 0.5,
        focalY: 0.45,
        mobileFocalX: 0.5,
        mobileFocalY: 0.4,
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
  if (faqItems.length > 0 && funnel.faq) {
    jsonLd.push(faqJsonLd(faqItems));
  }

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

        {funnel.trust ? (
          <HomeTrustStrip
            property={property}
            fromPriceBtn={rateRooms.lowestFromBtn}
            seasonName={rateRooms.seasonName}
            taxInclusive={rateRooms.taxInclusive}
            ratesMissing={ratesMissing}
          />
        ) : null}

        {funnel.proof ? <HomeProof /> : null}

        {homepageStory.about.enabled ? (
          <HomeStorySection id="about" block={homepageStory.about} />
        ) : null}

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

        {funnel.why ? <HomeWhy /> : null}

        {funnel.inHouse ? <HomeInHouse /> : null}

        {/* Optional ERP deep-dives (magazine bands) — after clustered in-house */}
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

        {funnel.faq ? <HomeFaqTeaser items={faqItems} /> : null}

        {page?.sections_json?.length ? (
          <section className="bg-gradient-to-b from-background to-sky-50/50 px-5 py-12 md:px-8 md:py-16">
            <CmsContentSections
              sections={page.sections_json}
              className="mx-auto max-w-[1120px]"
            />
          </section>
        ) : null}

        {funnel.agents ? <HomeAgents /> : null}
      </main>
      <SiteFooter profile={property} />
    </>
  );
}
