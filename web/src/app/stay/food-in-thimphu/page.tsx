import { SeoHubPage } from "@/components/site/SeoHubPage";
import { SITE_NAME } from "@/lib/site";
import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildPageMetadata({
  ...PAGE_SEO.foodThimphu,
  path: "/stay/food-in-thimphu",
  ogAlt: "Dining at Pelbu Suites restaurant, Olakha Thimphu",
});

const SECTIONS = [
  {
    title: "Good food without leaving the hotel",
    body: "If you searched for best food or good food in Thimphu and you are staying — or dining — near Olakha, our kitchen covers Indian, Bhutanese and multicuisine plates for breakfast, lunch and dinner when posted. The dining room seats tour groups up to capacity with advance notice.",
    href: "/restaurant",
    linkLabel: "Restaurant details",
  },
  {
    title: "Cafe, pastry and all-day coffee stops",
    body: "PELBU ZONE and the cafe board serve coffee, breakfast and pastry for guests, guides and neighbours. Order for the table, pickup, or taxi delivery across parts of Thimphu when the online menu allows.",
    href: "/cafe",
    linkLabel: "Cafe & pastry",
  },
  {
    title: "Live menu and one-tap order",
    body: "Prices and dish availability come from the live menu — never guess from this page. Order cafe, pastry, restaurant and bar items from one board for pickup or delivery.",
    href: "/menu",
    linkLabel: "Browse menu & order",
  },
  {
    title: "Lunch for day visitors and tour groups",
    body: "Groups that are not overnighting can still schedule a lunch package when capacity allows. Contact the desk with headcount and timing so the kitchen can prepare properly.",
    href: "/contact",
    linkLabel: "Schedule with the desk",
  },
];

const FAQS = [
  {
    question: "Is the restaurant open to non-guests?",
    answer:
      "Yes — day visitors are welcome during posted restaurant hours, subject to capacity. Larger groups should reserve or message the desk first.",
  },
  {
    question: "What kind of food do you serve?",
    answer:
      "Indian, Bhutanese and multicuisine plates, with cafe coffee and pastry for lighter meals. Check the live menu for today’s dishes and prices.",
  },
  {
    question: "Can I order food for delivery in Thimphu?",
    answer:
      "Yes when taxi delivery is offered on the menu board for your area. Delivery times and zones can change — confirm at order.",
  },
  {
    question: "Do you have a fixed lunch package for tourists?",
    answer:
      "We publish a lunch package option for day visitors and groups when capacity allows. Amounts and inclusions are shown on the homepage lunch band and confirmed by the desk — never assume an offline quote.",
  },
];

export default function FoodInThimphuPage() {
  return (
    <SeoHubPage
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Food in Thimphu", path: "/stay/food-in-thimphu" },
      ]}
      eyebrow="Dining · Thimphu"
      title="Good food in Thimphu — restaurant & cafe in Olakha"
      description={`Eat well at ${SITE_NAME}: multicuisine restaurant, cafe and pastry under one roof in Olakha — for hotel guests, day visitors and tour groups who need a reliable table.`}
      primaryHref="/menu"
      primaryLabel="Order from the menu"
      secondaryHref="/restaurant"
      secondaryLabel="Restaurant"
      sections={SECTIONS}
      faqs={FAQS}
    />
  );
}
