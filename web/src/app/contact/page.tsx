import { ContactForm } from "@/components/contact/ContactForm";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { MediaCard } from "@/components/site/MediaCard";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { Button } from "@/components/ui/button";
import { BRAND_CLOUDINARY, BRAND_ICONS } from "@/lib/brand";
import { loadCmsPage } from "@/lib/cms";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import {
  aboutPageJsonLd,
  breadcrumbJsonLd,
  contactPageJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const WHAT_WE_RUN = [
  {
    href: "/rooms",
    title: "Rooms",
    description: "Suites and guest rooms for short city stays.",
    publicId: BRAND_CLOUDINARY.roomsDeluxe,
  },
  {
    href: "/cafe",
    title: "Cafe & pastry",
    description: "Coffee, breakfast, and warm pastry.",
    publicId: BRAND_CLOUDINARY.cafePastry,
  },
  {
    href: "/restaurant",
    title: "Restaurant",
    description: "Indian, Bhutanese, and multicuisine plates.",
    publicId: BRAND_CLOUDINARY.restaurantPlate,
  },
  {
    href: "/bar",
    title: "Bar",
    description: "Calm pours for guests and neighbours.",
    publicId: BRAND_CLOUDINARY.barPour,
  },
  {
    href: "/spa",
    title: "Spa & steam",
    description: "Focused recovery after the road or trek.",
    publicId: BRAND_CLOUDINARY.spaSteam,
  },
  {
    href: "/meeting",
    title: "Meeting",
    description: "A room that gets out of the way.",
    publicId: BRAND_CLOUDINARY.diningRoom,
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadCmsPage("contact");
  return {
    title: page?.seo_title ?? "About & Contact | Pelbu Suites",
    description:
      page?.meta_description ??
      "About Pelbu Suites in Olakha, Thimphu — rooms, dining, spa, meeting, and how to reach the desk.",
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage() {
  const [page, property] = await Promise.all([
    loadCmsPage("contact"),
    loadPublicPropertyProfile(),
  ]);

  const storyImage =
    cloudinaryUrl(BRAND_CLOUDINARY.roomsSuiteView, {
      width: 1600,
      height: 1000,
      crop: "fill",
    }) ?? null;

  const title = page?.title ?? "A practical hotel base in Olakha.";
  const body =
    page?.body ??
    "Pelbu Suites brings rooms, cafe, restaurant, bar, spa, and meeting space under one roof in Olakha, Thimphu. We keep the theatre out of the stay — clear rates, live menus, and a desk that answers.";
  const eyebrow = page?.eyebrow ?? "About & contact";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "About & contact", path: "/contact" },
            ]),
            aboutPageJsonLd({
              description: page?.summary ?? body,
              image: storyImage,
            }),
            contactPageJsonLd({
              telephone: property?.phone,
              email: property?.email,
              address: property?.address,
            }),
          ]),
        }}
      />
      <PublicSiteHeader logoSrc={BRAND_ICONS.mark} variant="solid" />
      <main>
        <section className="border-b border-border bg-gradient-to-b from-sky-100/40 to-background">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-14 md:grid-cols-2 md:items-center md:px-8 md:py-20">
            <div>
              <p className="text-sm font-medium text-sky-700">{eyebrow}</p>
              <h1 className="mt-3 font-display text-4xl leading-tight text-foreground md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {body}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="citrus">
                  <a href={page?.primary_cta_href ?? "/book"}>
                    {page?.primary_cta_label ?? "Check rooms"}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={page?.secondary_cta_href ?? "/menu"}>
                    {page?.secondary_cta_label ?? "See the menu"}
                  </a>
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
              <CloudinaryImage
                publicId={BRAND_CLOUDINARY.roomsSuiteView}
                alt="Pelbu Suites suite interior"
                ratio="16/10"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>

        <section className="px-5 py-14 md:px-8 md:py-16">
          <CmsContentSections
            sections={page?.sections_json}
            className="mx-auto max-w-[1120px]"
          />
        </section>

        <section className="px-5 pb-14 md:px-8 md:pb-16">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="font-display text-2xl text-foreground md:text-3xl">
              What we run
            </h2>
            <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
              Six practical doors into the same Olakha building.
            </p>
            <ul className="mt-8 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {WHAT_WE_RUN.map((item) => (
                <li key={item.href} className="h-full">
                  <MediaCard
                    href={item.href}
                    title={item.title}
                    description={item.description}
                    publicId={item.publicId}
                    ratio="4/3"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-border bg-frost-2/60 px-5 py-14 md:px-8 md:py-16">
          <div className="mx-auto grid max-w-[1120px] gap-10 md:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="font-display text-2xl text-foreground">
                Find the desk
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                Live name, address, and phone from the property record — we do
                not invent missing details.
              </p>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Property</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {property?.name ?? "Pelbu Suites"}
                  </dd>
                </div>
                {property?.address ? (
                  <div>
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="mt-1 text-foreground">{property.address}</dd>
                  </div>
                ) : null}
                {property?.phone ? (
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="mt-1">
                      <a
                        href={`tel:${property.phone}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {property.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {property?.whatsapp ? (
                  <div>
                    <dt className="text-muted-foreground">WhatsApp</dt>
                    <dd className="mt-1">
                      <a
                        href={`https://wa.me/${property.whatsapp.replace(/\D+/g, "")}`}
                        className="font-medium text-sky-700 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Message the desk
                      </a>
                    </dd>
                  </div>
                ) : null}
                {property?.email ? (
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${property.email}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {property.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {property?.mapsUrl ? (
                  <div>
                    <dt className="text-muted-foreground">Map</dt>
                    <dd className="mt-1">
                      <a
                        href={property.mapsUrl}
                        className="font-medium text-sky-700 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Google Maps
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
              <h2 className="font-display text-2xl text-foreground">
                Send a message
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Share the details once. The desk can reply by phone, WhatsApp,
                or email with the next useful action.
              </p>
              <div className="mt-6">
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter profile={property} />
    </>
  );
}
