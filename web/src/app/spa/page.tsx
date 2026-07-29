import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { ConversionShell } from "@/components/site/ConversionShell";
import { BRAND_CLOUDINARY } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";

export const metadata = {
  title: "Spa & Steam | Pelbu Suites",
  description:
    "Book a spa treatment or steam session at Pelbu Suites, Olakha Thimphu — open to hotel guests and day visitors.",
};

export default function SpaPage() {
  const heroSrc = cloudinaryUrl(BRAND_CLOUDINARY.spaSteam, {
    width: 1600,
    crop: "fill",
  });

  return (
    <ConversionShell
      heroSrc={heroSrc}
      eyebrow="Spa"
      title="Slow down after the road."
      body="Massage and steam for guests and day visitors. Tell us your slot — we confirm with the therapist."
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">Good to know</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Rates confirmed by the desk</li>
            <li>In-house guests can charge to folio</li>
            <li>Slots depend on therapist availability</li>
          </ul>
          <p>
            Staying overnight?{" "}
            <a href="/book" className="underline underline-offset-4">
              Reserve a room
            </a>{" "}
            first.
          </p>
        </div>
      }
    >
      <ServiceRequestForm kind="spa" />
    </ConversionShell>
  );
}
