import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Manrope } from "next/font/google";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ICONS } from "@/lib/brand";
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
  title: {
    default: "BHO — Bhutan Hotel OS",
    template: "%s | BHO",
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
    { media: "(prefers-color-scheme: light)", color: "#f7fbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#082f49" },
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
