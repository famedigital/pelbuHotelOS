import { BRAND_ICONS } from "@/lib/brand";

/**
 * First-paint branded loading splash. Server-rendered so it appears in the
 * initial HTML (before hydration). A tiny inline gate script sets
 * `data-splash` on `<html>` (never mutating the splash node itself) to hide
 * it on private/staff routes and on repeat visits within a session;
 * `SplashController` flips that attribute to `done` once the window has
 * loaded. Motion respects reduced-motion via the global rule in globals.css.
 *
 * Never call `remove()` / mutate attributes on `#pelbu-splash` — React owns
 * that node and doing so causes insertBefore/removeChild NotFoundError.
 */

// Kept in sync with PwaRegistrar / InstallPrompt — public site only.
const SPLASH_GATE = `(function(){try{
var d=document.documentElement,p=location.pathname;
var priv=['/erp','/staff','/agents/app','/agents/portal','/login','/pay'];
var off=priv.some(function(x){return p===x||p.indexOf(x+'/')===0;});
if(!off){try{if(sessionStorage.getItem('pelbu-splash-seen'))off=true;
else sessionStorage.setItem('pelbu-splash-seen','1');}catch(e){}}
d.setAttribute('data-splash',off?'off':'on');
}catch(e){document.documentElement.setAttribute('data-splash','off');}})();`;

export function BrandSplash() {
  return (
    <>
      <script
        // Pre-hydration gate: runs at parse time (before the splash div) so
        // data-splash is set before the overlay paints — zero flash on ERP.
        dangerouslySetInnerHTML={{ __html: SPLASH_GATE }}
      />
      <noscript>
        <style>{`#pelbu-splash{display:none}`}</style>
      </noscript>
      <div
        id="pelbu-splash"
        role="status"
        aria-label="Loading Pelbu Suites"
      >
        <div className="pelbu-splash__stage">
          <span className="pelbu-splash__ring" aria-hidden="true" />
          {/* Local public icon — plain img; next/image uses Cloudinary loader. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt=""
            width={96}
            height={96}
            className="pelbu-splash__mark"
          />
        </div>
        <p className="pelbu-splash__word">Pelbu Suites</p>
      </div>
    </>
  );
}
