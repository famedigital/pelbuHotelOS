import { SeoHubPage } from "@/components/site/SeoHubPage";
import { SITE_NAME } from "@/lib/site";
import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildPageMetadata({
  ...PAGE_SEO.facilities,
  path: "/stay/facilities-service",
  ogAlt: "Facilities at Pelbu Suites hotel, Olakha",
});

const SECTIONS = [
  {
    title: "Facilities guests actually use",
    body: "Quiet rooms for sleep, restaurant and cafe for meals, spa and steam for recovery after road days, meeting space when the group needs table space. Facilities stay on one property so the day stays simple.",
    href: "/rooms",
    linkLabel: "Rooms",
  },
  {
    title: "Good service, plain process",
    body: "Direct booking with timed holds, desk confirmation for payment or agent credit, and WhatsApp or phone for practical questions. Staff aim for clear answers — rates, hours and policies come from published CMS and operational systems, not guesswork.",
    href: "/faq",
    linkLabel: "Read the FAQ",
  },
  {
    title: "Wellness and on-site recovery",
    body: "Spa treatments and steam sessions for guests and day visitors when booked. Suite guests may have exclusive jacuzzi access where listed — check the room type before you assume amenity access.",
    href: "/spa",
    linkLabel: "Spa & steam",
  },
  {
    title: "Agent groups and FOC beds",
    body: "Travel partners can arrange groups with complimentary guide and driver beds on qualifying stays. That is operational policy — always confirm terms with the desk or your rate agreement.",
    href: "/agents",
    linkLabel: "Agent information",
  },
];

const FAQS = [
  {
    question: "What facilities does Pelbu Suites have?",
    answer:
      "Guest rooms and suites, restaurant, cafe and pastry, bar when open, spa and steam, and meeting space. Exact opening hours and dish availability are posted on each outlet page and the menu.",
  },
  {
    question: "Is service suitable for international and regional guests?",
    answer:
      "Yes. English is available at the desk, menus cover Indian, Bhutanese and multicuisine tastes, and staff work regularly with tour groups and FIT travellers.",
  },
  {
    question: "How do I get help before arrival?",
    answer:
      "Use the contact form, phone or WhatsApp listed on Contact. For bookings, start with live availability on the rooms or book path so holds stay accurate.",
  },
];

export default function FacilitiesServicePage() {
  return (
    <SeoHubPage
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Facilities & service", path: "/stay/facilities-service" },
      ]}
      eyebrow="Why stay · Service"
      title="Good facilities and service in Thimphu"
      description={`At ${SITE_NAME} in Olakha, facilities and hospitality are practical: rooms to sleep well, food on site, spa when you need to recover, and a desk that answers in clear terms.`}
      primaryHref="/book"
      primaryLabel="Book a stay"
      secondaryHref="/contact"
      secondaryLabel="Talk to the desk"
      sections={SECTIONS}
      faqs={FAQS}
    />
  );
}
