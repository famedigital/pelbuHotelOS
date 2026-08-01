import assert from "node:assert/strict";
import test from "node:test";

test("absoluteUrl rejects localhost when VERCEL_URL is set", async () => {
  const previous = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercel: process.env.VERCEL_URL,
  };
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_APP_URL = "";
  process.env.VERCEL_URL = "pelbusuites.vercel.app";

  const { absoluteUrl } = await import(`./site.ts?ts=${Date.now()}`);
  assert.equal(
    absoluteUrl("/staff/laundry/bags/test?t=abc"),
    "https://pelbusuites.vercel.app/staff/laundry/bags/test?t=abc",
  );

  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.VERCEL_URL = previous.vercel;
});

test("absoluteUrl prefers NEXT_PUBLIC_APP_URL when set", async () => {
  const previous = {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercel: process.env.VERCEL_URL,
  };
  process.env.NEXT_PUBLIC_APP_URL = "https://app.pelbusuites.bt";
  process.env.NEXT_PUBLIC_SITE_URL = "https://pelbusuites.bt";
  delete process.env.VERCEL_URL;

  const { absoluteUrl } = await import(`./site.ts?ts=${Date.now()}`);
  assert.equal(absoluteUrl("/laundry"), "https://app.pelbusuites.bt/laundry");

  process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  process.env.VERCEL_URL = previous.vercel;
});
