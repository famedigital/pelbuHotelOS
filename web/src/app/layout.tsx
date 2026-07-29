import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Geist_Mono } from "next/font/google";
import { BRAND_ICONS } from "@/lib/brand";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fontDisplay = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pelbu Suites | Olakha, Thimphu",
  description:
    "Modern 3-star hotel in Olakha, Thimphu — rooms, cafe, pastry, restaurant, spa, meeting.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pelbu Suites",
  },
  icons: {
    icon: [
      { url: BRAND_ICONS.favicon, sizes: "32x32" },
      { url: BRAND_ICONS.favicon16, sizes: "16x16", type: "image/png" },
      { url: BRAND_ICONS.favicon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ICONS.mark, sizes: "192x192", type: "image/png" },
      { url: BRAND_ICONS.markLg, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: BRAND_ICONS.appleTouch,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1612",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
