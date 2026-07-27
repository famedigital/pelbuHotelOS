import { StreamPage } from "@/components/site/StreamPage";

export const metadata = {
  title: "Contact | Pelbu Suites",
  description: "Contact Pelbu Suites, Olakha Thimphu Bhutan.",
};

export default function ContactPage() {
  return (
    <StreamPage
      eyebrow="Contact"
      title="Olakha, Thimphu."
      body="Front desk for rooms, dining, spa, and meeting enquiries. Agents: send license details for approval before credit booking."
      primaryHref="/book"
      primaryLabel="Book a stay"
      secondaryHref="/agents"
      secondaryLabel="Agent portal"
    />
  );
}
