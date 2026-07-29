import { ContactForm } from "@/components/contact/ContactForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Contact | Pelbu Suites",
  description:
    "Contact Pelbu Suites front desk in Olakha, Thimphu — rooms, dining, spa, meeting, and agent enquiries.",
};

export default function ContactPage() {
  return (
    <ConversionShell
      eyebrow="Contact"
      title="Talk to the Olakha desk."
      body="Send a message — we reply by phone, WhatsApp, or email during desk hours."
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">Faster paths</p>
          <ul className="space-y-2">
            <li>
              <a href="/book" className="underline underline-offset-4">
                Book a stay
              </a>
            </li>
            <li>
              <a href="/order" className="underline underline-offset-4">
                Order cafe &amp; pastry
              </a>
            </li>
            <li>
              <a href="/agents" className="underline underline-offset-4">
                Apply as travel agent
              </a>
            </li>
          </ul>
          <p className="pt-2">Pelbu Suites · Olakha, Thimphu, Bhutan</p>
        </div>
      }
    >
      <ContactForm />
    </ConversionShell>
  );
}
