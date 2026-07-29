import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Meeting Hall | Pelbu Suites",
  description:
    "A focused meeting hall for up to 25 people at Pelbu Suites, Olakha Thimphu — with cafe catering on request.",
};

export default function MeetingPage() {
  return (
    <ConversionShell
      eyebrow="Meeting"
      title="Up to 25 guests. Focused and well set."
      body="Board and briefing layouts, with the cafe next door for tea breaks. Send a date — we confirm within business hours."
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">The hall</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Capacity up to 25</li>
            <li>Board, classroom, or briefing layout</li>
            <li>Catering via the cafe</li>
          </ul>
          <p>
            Need rooms?{" "}
            <a href="/book" className="underline underline-offset-4">
              Reserve stays
            </a>
            .
          </p>
        </div>
      }
    >
      <ServiceRequestForm kind="meeting" />
    </ConversionShell>
  );
}
