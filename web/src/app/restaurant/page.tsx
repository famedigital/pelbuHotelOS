import { StreamPage } from "@/components/site/StreamPage";

export const metadata = {
  title: "Restaurant | Pelbu Suites",
  description: "Indian, Bhutanese, and multicuisine restaurant at Pelbu Suites, Olakha Thimphu.",
};

export default function RestaurantPage() {
  return (
    <StreamPage
      eyebrow="Restaurant"
      title="Indian · Bhutanese · Multicuisine"
      body="Breakfast, lunch, and dinner with TACT — taste, aroma, consistency, and time. Signature plates you will not find on every Thimphu corner."
      primaryHref="/book"
      primaryLabel="Reserve a table"
      secondaryHref="/order"
      secondaryLabel="Order delivery"
    />
  );
}
