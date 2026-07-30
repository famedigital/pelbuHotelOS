import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff | Pelbu Suites",
  robots: { index: false, follow: false },
  manifest: "/staff.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pelbu Staff",
  },
};

export default function StaffRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
