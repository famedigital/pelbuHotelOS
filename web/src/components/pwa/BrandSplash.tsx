import Image from "next/image";

import { BRAND_ICONS } from "@/lib/brand";

/**
 * First-paint branded loading splash. Server-rendered so it appears in the
 * initial HTML (before hydration). A tiny inline gate script hides it on
 * private/staff routes and on repeat visits within a session; `SplashController`
 * fades it out once the window has loaded. Motion respects reduced-motion via
 * the global rule in globals.css.
 */

// Kept in sync with PwaRegistrar / InstallPrompt — public site only.
const SPLASH_GATE = `(function(){try{
var el=document.getElementById('pelbu-splash');if(!el)return;
var p=location.pathname;
var priv=['/erp','/staff','/agents/app','/agents/portal','/login','/pay'];
var isPriv=priv.some(function(x){return p===x||p.indexOf(x+'/')===0;});
var seen=false;try{seen=!!sessionStorage.getItem('pelbu-splash-seen');}catch(e){}
if(isPriv||seen){el.setAttribute('data-state','off');}
else{try{sessionStorage.setItem('pelbu-splash-seen','1');}catch(e){}}
}catch(e){}})();`;

export function BrandSplash() {
  return (
    <>
      <div
        id="pelbu-splash"
        data-state="show"
        role="status"
        aria-label="Loading Pelbu Suites"
      >
        <div className="pelbu-splash__stage">
          <span className="pelbu-splash__ring" aria-hidden="true" />
          <Image
            src={BRAND_ICONS.markLg}
            alt=""
            width={96}
            height={96}
            priority
            className="pelbu-splash__mark"
          />
        </div>
        <p className="pelbu-splash__word">Pelbu Suites</p>
      </div>
      <script
        // Pre-hydration gate: runs at parse time to avoid a splash flash on
        // staff/POS routes and repeat navigations.
        dangerouslySetInnerHTML={{ __html: SPLASH_GATE }}
      />
    </>
  );
}
