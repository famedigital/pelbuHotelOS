import assert from "node:assert/strict";
import test from "node:test";

test("absoluteUrl never uses *.vercel.app (GSC sitemap hosts)", async () => {
  const previous = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercel: process.env.VERCEL_URL,
    vercelFlag: process.env.VERCEL,
  };
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_APP_URL = "";
  process.env.VERCEL_URL = "pelbu-8i7p2sfsq-rajiv-pradhans-projects.vercel.app";
  process.env.VERCEL = "1";

  const { absoluteUrl, getSiteUrl, PRODUCTION_CANONICAL } = await import(
    `./site.ts?ts=${Date.now()}`
  );
  assert.equal(
    absoluteUrl("/rooms"),
    `${PRODUCTION_CANONICAL}/rooms`,
  );
  assert.equal(getSiteUrl().origin, PRODUCTION_CANONICAL);

  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.VERCEL_URL = previous.vercel;
  process.env.VERCEL = previous.vercelFlag;
});

test("absoluteUrl prefers NEXT_PUBLIC_APP_URL when set to custom domain", async () => {
  const previous = {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercel: process.env.VERCEL_URL,
    vercelFlag: process.env.VERCEL,
  };
  process.env.NEXT_PUBLIC_APP_URL = "https://app.pelbusuites.bt";
  process.env.NEXT_PUBLIC_SITE_URL = "https://pelbusuites.bt";
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL;

  const { absoluteUrl } = await import(`./site.ts?ts=${Date.now()}-app`);
  assert.equal(absoluteUrl("/laundry"), "https://app.pelbusuites.bt/laundry");

  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.VERCEL_URL = previous.vercel;
  process.env.VERCEL = previous.vercelFlag;
});

test("getSiteUrl prefers SITE_URL for SEO when both custom domains set", async () => {
  const previous = {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercel: process.env.VERCEL_URL,
    vercelFlag: process.env.VERCEL,
  };
  process.env.NEXT_PUBLIC_APP_URL = "https://app.pelbusuites.bt";
  process.env.NEXT_PUBLIC_SITE_URL = "https://pelbusuites.bt";
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL;

  const { getSiteUrl } = await import(`./site.ts?ts=${Date.now()}-site`);
  assert.equal(getSiteUrl().origin, "https://pelbusuites.bt");

  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.VERCEL_URL = previous.vercel;
  process.env.VERCEL = previous.vercelFlag;
});
