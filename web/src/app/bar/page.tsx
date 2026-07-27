import { StreamPage } from "@/components/site/StreamPage";

export const metadata = {
  title: "Bar | Pelbu Suites",
  description: "Weekend bar menu at Pelbu Suites, Thimphu.",
};

export default function BarPage() {
  return (
    <StreamPage
      eyebrow="Bar"
      title="Weekend pours."
      body="A calm bar for guests and locals — weekend specials, classic pours, and space to unwind after the road to Thimphu."
      primaryHref="/book"
      primaryLabel="Reserve"
      secondaryHref="/dine"
      secondaryLabel="All dining"
    />
  );
}
