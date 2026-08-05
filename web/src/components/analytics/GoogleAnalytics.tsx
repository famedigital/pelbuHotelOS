"use client";

import { GA_MEASUREMENT_ID, shouldTrackAnalyticsPath } from "@/lib/analytics";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function pagePath(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const qs = searchParams?.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Loads GA4 once and sends page_view on public route changes.
 * No-op when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset.
 * Desk / staff / payment routes never load the tag.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = GA_MEASUREMENT_ID;
  const [ready, setReady] = useState(false);
  const trackable = shouldTrackAnalyticsPath(pathname);

  const sendPageView = useCallback(() => {
    if (!id || typeof window.gtag !== "function") return;
    if (!shouldTrackAnalyticsPath(pathname)) return;
    window.gtag("config", id, {
      page_path: pagePath(pathname, searchParams),
      anonymize_ip: true,
    });
  }, [id, pathname, searchParams]);

  useEffect(() => {
    if (!ready) return;
    sendPageView();
  }, [ready, sendPageView]);

  if (!id || !trackable) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}', {
            send_page_view: false,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
