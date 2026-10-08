import { Fraunces, Lora } from "next/font/google";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";

const fontDisplay = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const fontSerif = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`marketing ${fontDisplay.variable} ${fontSerif.variable} flex min-h-screen flex-col bg-background text-foreground`}
    >
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
