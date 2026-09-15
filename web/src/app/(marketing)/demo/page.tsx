import type { Metadata } from "next";
import { DemoRequestForm } from "@/components/marketing/DemoRequestForm";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "Request an Innora walkthrough for your Bhutan hotels — desk, folio, POS, multi-property.",
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.howLive}
        title="Request an Innora demo"
        description="Tell us how many hotels you run and what you need — desk, folio, POS, multi-property."
      />
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 md:grid-cols-2 md:px-10">
        <div className="overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MARKETING_MEDIA.staffDesk.src}
            alt={MARKETING_MEDIA.staffDesk.alt}
            className="aspect-[4/5] h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div>
          <DemoRequestForm />
        </div>
      </div>
    </>
  );
}
