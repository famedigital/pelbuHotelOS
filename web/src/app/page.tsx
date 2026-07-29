import { HomeCtaBand } from "@/components/home/HomeCtaBand";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeStreams } from "@/components/home/HomeStreams";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BRAND_ICONS, HOME_HERO_SLIDES } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const slides = HOME_HERO_SLIDES.map((slide) => ({
    ...slide,
    src:
      cloudinaryUrl(slide.publicId, {
        width: 1920,
        height: 1080,
        crop: "fill",
      }) ?? "",
  })).filter((s) => s.src);

  return (
    <>
      <SiteHeader logoSrc={BRAND_ICONS.mark} variant="ink" />
      <main>
        <HomeHero slides={slides} />
        <HomeStreams />
        <HomeCtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
