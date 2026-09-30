import type { Metadata } from "next";
import { DemoRequestForm } from "@/components/marketing/DemoRequestForm";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "Request an Innora walkthrough for your Bhutan hotels — desk, folio, POS, multi-property.",
  robots: { index: true, follow: true },
};

const WALKTHROUGH = [
  "The desk",
  "The folio",
  "POS",
  "DOT assessment",
  "The rota",
  "The daily printouts",
  "A booking page on your domain",
] as const;

export default function DemoPage() {
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-12 px-6 pb-16 pt-28 md:grid-cols-2 md:px-10">
      <div>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          Request an Innora demo
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Tell us how many hotels you run. The walkthrough covers:
        </p>
        <ul className="mt-4 space-y-2 text-base">
          {WALKTHROUGH.map((item) => (
            <li key={item} className="border-b border-border py-2">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <DemoRequestForm />
    </div>
  );
}
