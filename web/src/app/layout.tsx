import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Outfit } from "next/font/google";
import { Suspense } from "react";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { resolveShareImage } from "@/lib/og-share";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { BrandSplash } from "@/components/pwa/BrandSplash";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";
import { SplashController } from "@/components/pwa/SplashController";
import { BackToTop } from "@/components/site/BackToTop";
import { PublicMenuChromeProvider } from "@/components/site/public-menu-chrome";
import { PublicMobileNav } from "@/components/site/PublicMobileNav";
import { PublicStaySearchProvider } from "@/components/site/PublicStaySearch";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ICONS } from "@/lib/brand";
import "./globals.css";

const fontSans = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const fontDisplay = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const defaultShare = resolveShareImage(
  null,
  "Pelbu Suites hotel in Olakha, Thimphu",
);

const googleVerify = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const bingVerify = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Pelbu Suites | Hotel in Olakha, Thimphu, Bhutan",
    template: "%s | Pelbu Suites",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "travel",
  // Indexable by default; ERP/staff layouts set noindex.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  ...(googleVerify || bingVerify
    ? {
        verification: {
          ...(googleVerify ? { google: googleVerify } : {}),
          ...(bingVerify
            ? { other: { "msvalidate.01": bingVerify } }
            : {}),
        },
      }
    : {}),
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_BT",
    siteName: SITE_NAME,
    title: "Pelbu Suites | Hotel in Olakha, Thimphu, Bhutan",
    description: SITE_DESCRIPTION,
    url: "/",
    images: [defaultShare],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pelbu Suites | Hotel in Olakha, Thimphu, Bhutan",
    description: SITE_DESCRIPTION,
    images: [defaultShare.url],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pelbu Suites",
  },
  icons: {
    icon: [
      { url: BRAND_ICONS.favicon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ICONS.favicon16, sizes: "16x16", type: "image/png" },
      { url: BRAND_ICONS.favicon, sizes: "any" },
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1613" },
  ],
  colorScheme: "light",
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
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <BrandSplash />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <PublicStaySearchProvider>
            <PublicMenuChromeProvider>
              {children}
              <PublicMobileNav />
              <BackToTop />
              <PwaRegistrar />
              <SplashController />
              <InstallPrompt />
              <Toaster position="top-right" richColors closeButton />
            </PublicMenuChromeProvider>
          </PublicStaySearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
