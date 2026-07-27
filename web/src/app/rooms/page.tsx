import { StreamPage } from "@/components/site/StreamPage";

export const metadata = {
  title: "Rooms | Pelbu Suites",
  description: "Book rooms at Pelbu Suites, Olakha Thimphu — peak, lean, and off-season rates.",
};

export default function RoomsPage() {
  return (
    <StreamPage
      eyebrow="Rooms"
      title="Rest in Olakha."
      body="Quiet suites for guests traveling Bhutan — book direct, or ask your agent to reserve with guide and driver beds included."
      primaryHref="/book"
      primaryLabel="Check availability"
      secondaryHref="/agents"
      secondaryLabel="Agent booking"
    />
  );
}
