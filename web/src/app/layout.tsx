import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Geist_Mono, Lora } from "next/font/google";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ICONS } from "@/lib/brand";
import "./globals.css";

const fontSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

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

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Innora — hotel software for Bhutan",
    template: "%s | Innora",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "business",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_BT",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  icons: {
    icon: [
      { url: BRAND_ICONS.favicon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ICONS.favicon16, sizes: "16x16", type: "image/png" },
      { url: BRAND_ICONS.favicon, sizes: "any" },
      { url: BRAND_ICONS.mark, type: "image/svg+xml" },
      { url: BRAND_ICONS.markRaster, sizes: "192x192", type: "image/png" },
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
    { media: "(prefers-color-scheme: light)", color: "#f5f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2332" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="ocean-breeze-light" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} ${fontSerif.variable} ${fontMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
