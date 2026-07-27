import { StreamPage } from "@/components/site/StreamPage";

export const metadata = {
  title: "Cafe & Pastry | Pelbu Suites",
  description: "Cafe and pastry at Pelbu Suites — opens 6:30 summer / 7:30 winter. Order for taxi delivery in Thimphu.",
};

export default function CafePage() {
  return (
    <StreamPage
      eyebrow="Cafe & Pastry"
      title="Morning light, warm pastry."
      body="Opens 6:30 AM in summer and 7:30 AM in winter. Breakfast through dinner — order for pickup or taxi delivery across Thimphu."
      primaryHref="/order"
      primaryLabel="Order now"
      secondaryHref="/restaurant"
      secondaryLabel="Restaurant menu"
    />
  );
}
