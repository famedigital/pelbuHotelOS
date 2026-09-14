import assert from "node:assert/strict";
import test from "node:test";

test("absoluteUrl never uses *.vercel.app", async () => {
  const previous = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercel: process.env.VERCEL_URL,
    vercelFlag: process.env.VERCEL,
  };
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_APP_URL = "";
  process.env.VERCEL_URL = "hotelos-preview.vercel.app";
  process.env.VERCEL = "1";

  const { absoluteUrl, getSiteUrl, PRODUCTION_CANONICAL } = await import(
    `./site.ts?ts=${Date.now()}`
  );
  // On Vercel with only localhost SITE_URL, fall through to PRODUCTION_CANONICAL
  // after rejecting vercel.app — PRODUCTION_CANONICAL itself may be localhost.
  assert.ok(getSiteUrl().origin);
  assert.ok(!absoluteUrl("/erp").includes("vercel.app"));
  assert.ok(PRODUCTION_CANONICAL);

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
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL;

  const { absoluteUrl } = await import(`./site.ts?ts=${Date.now()}-app`);
  assert.equal(absoluteUrl("/erp"), "https://app.example.com/erp");

  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.VERCEL_URL = previous.vercel;
  process.env.VERCEL = previous.vercelFlag;
});

test("getSiteUrl prefers SITE_URL when both custom domains set", async () => {
  const previous = {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercel: process.env.VERCEL_URL,
    vercelFlag: process.env.VERCEL,
  };
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL;

  const { getSiteUrl } = await import(`./site.ts?ts=${Date.now()}-site`);
  assert.equal(getSiteUrl().origin, "https://example.com");

  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.VERCEL_URL = previous.vercel;
  process.env.VERCEL = previous.vercelFlag;
});
