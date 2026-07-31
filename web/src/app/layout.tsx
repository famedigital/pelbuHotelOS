import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Manrope } from "next/font/google";
import { BRAND_CLOUDINARY, BRAND_ICONS } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { BrandSplash } from "@/components/pwa/BrandSplash";
import { FaviconAnimator } from "@/components/pwa/FaviconAnimator";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";
import { SplashController } from "@/components/pwa/SplashController";
import { BackToTop } from "@/components/site/BackToTop";
import { PublicMobileNav } from "@/components/site/PublicMobileNav";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontSans = Manrope({
  variable: "--font-manrope",
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
  metadataBase: getSiteUrl(),
  title: "Pelbu Suites | Hotel in Olakha, Thimphu",
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_BT",
    siteName: SITE_NAME,
    title: "Pelbu Suites | Hotel in Olakha, Thimphu",
    description: SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url:
          cloudinaryUrl(BRAND_CLOUDINARY.roomsSuiteAlt, {
            width: 1200,
            height: 630,
            crop: "fill",
          }) ?? BRAND_ICONS.markLg,
        width: 1200,
        height: 630,
        alt: "Suite at Pelbu Suites in Olakha, Thimphu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pelbu Suites | Hotel in Olakha, Thimphu",
    description: SITE_DESCRIPTION,
  },
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
  themeColor: "#0b1020",
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
        <BrandSplash />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <PublicMobileNav />
          <BackToTop />
          <PwaRegistrar />
          <FaviconAnimator />
          <SplashController />
          <InstallPrompt />
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
