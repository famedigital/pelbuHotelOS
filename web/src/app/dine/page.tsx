import { StreamPage } from "@/components/site/StreamPage";

export const metadata = {
  title: "Dine | Pelbu Suites",
  description: "Cafe, pastry, restaurant, and bar at Pelbu Suites Thimphu.",
};

export default function DinePage() {
  return (
    <StreamPage
      eyebrow="Dine"
      title="Cafe, restaurant, and bar."
      body="Indian, Bhutanese, and multicuisine in the restaurant — pastry and cafe from early morning — weekend bar menu for evenings."
      primaryHref="/restaurant"
      primaryLabel="Restaurant"
      secondaryHref="/cafe"
      secondaryLabel="Cafe & pastry"
    />
  );
}
