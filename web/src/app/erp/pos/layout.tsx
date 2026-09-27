import { PosPwaRegistrar } from "@/components/pwa/PosPwaRegistrar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "POS",
  description: "Sign in and open the register.",
  robots: { index: false, follow: false },
  manifest: "/pos.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "POS",
  },
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PosPwaRegistrar />
    </>
  );
}
