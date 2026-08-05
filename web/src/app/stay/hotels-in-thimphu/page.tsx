import { SeoHubPage } from "@/components/site/SeoHubPage";
import { SITE_NAME } from "@/lib/site";
import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildPageMetadata({
  ...PAGE_SEO.hotelThimphu,
  path: "/stay/hotels-in-thimphu",
  ogAlt: "Pelbu Suites hotel exterior in Olakha, Thimphu",
});

const SECTIONS = [
  {
    title: "A practical base for Thimphu, not just a bed",
    body: "Travellers searching for the best place to stay in Thimphu often need more than a mattress: a quiet night after the city, clear rates, and food or recovery without another taxi hop. Pelbu Suites sits in Olakha — close enough for day plans, calm enough to sleep well.",
    href: "/rooms",
    linkLabel: "See rooms & live availability",
  },
  {
    title: "Good rooms and good facilities under one roof",
    body: "Guest rooms and suites, on-site restaurant and cafe, spa and steam, plus meeting space when your group needs a quiet table. Facilities are built for short city stays and agent groups — not a mock brochure.",
    href: "/services",
    linkLabel: "Hotel services overview",
  },
  {
    title: "Direct rates and honest booking",
    body: "Publish public BAR on the rate card and book direct when that fits your trip. Agents can work trade terms separately. You always see season names and published prices before you hold a room.",
    href: "/rates",
    linkLabel: "View public rates",
  },
  {
    title: "Why Olakha works for many Thimphu visits",
    body: "Olakha gives a quieter edge of the capital with a short road into town. For guests who want a place to sleep without downtown noise — and still want dinner, coffee or steam on site — it is a deliberate choice.",
    href: "/stay/olakha-thimphu",
    linkLabel: "Stay in Olakha guide",
  },
];

const FAQS = [
  {
    question: "Is Pelbu Suites a good place to stay in Thimphu?",
    answer:
      "Guests choose Pelbu Suites for quiet rooms in Olakha, direct booking with live availability, and hotel facilities (restaurant, cafe, spa) on one property. Compare room types and rates, then book if the stay fits your plan.",
  },
  {
    question: "What makes a hotel good for a short Thimphu stay?",
    answer:
      "Clear check-in times, reliable Wi‑Fi when posted, dinner and breakfast options, and a calm room. At Pelbu Suites you also get spa/steam and meeting support without leaving the building.",
  },
  {
    question: "Do you take walk-in guests and day dining?",
    answer:
      "Rooms depend on availability — use live booking or contact the desk. Restaurant, cafe and spa welcome day visitors when operating hours allow; lunch packages for groups should be scheduled in advance.",
  },
  {
    question: "How do I book the best rate?",
    answer:
      "Check the public rate card for published seasons, then book direct on our site for BAR, or ask your travel agent for contracted terms. We do not invent prices on this page — only live published rates.",
  },
];

export default function HotelsInThimphuPage() {
  return (
    <SeoHubPage
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Hotels in Thimphu", path: "/stay/hotels-in-thimphu" },
      ]}
      eyebrow="Stay · Thimphu"
      title="Hotel and place to stay in Thimphu"
      description={`${SITE_NAME} in Olakha — a calm hotel base when you want a good night’s sleep, solid facilities, and food on site without chasing the whole capital for every meal.`}
      primaryHref="/rooms"
      primaryLabel="Check rooms"
      secondaryHref="/book"
      secondaryLabel="Book dates"
      sections={SECTIONS}
      faqs={FAQS}
    />
  );
}
