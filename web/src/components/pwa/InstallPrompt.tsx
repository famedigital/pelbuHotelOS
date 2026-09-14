"use client";

import { Download, Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pelbu-public-pwa-dismissed-at";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;
/** Wait before competing with primary book convert. */
const SHOW_AFTER_MS = 12_000;
/** Homepage: only after guest scrolls past the hero convert zone. */
const HOME_SCROLL_REVEAL_PX = 420;
const PRIVATE_PREFIXES = [
  "/erp",
  "/staff",
  "/agents/app",
  "/agents/portal",
  "/login",
  "/pay",
];

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window)
  );
}

function setCookie(name: string, value: string, maxAge: number): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [delayDone, setDelayDone] = useState(false);
  const [homeOk, setHomeOk] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    setDelayDone(false);
    setInstallEvent(null);

    if (PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      setEligible(false);
      return;
    }
    if (isStandalone()) {
      setCookie("pelbu_pwa", "public", 31_536_000);
      setEligible(false);
      return;
    }

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_FOR_MS) {
      setEligible(false);
      return;
    }

    setEligible(true);
    const delay = window.setTimeout(() => setDelayDone(true), SHOW_AFTER_MS);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setEligible(false);
      setCookie("pelbu_pwa", "public", 31_536_000);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(delay);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") {
      setHomeOk(true);
      return;
    }
    const onScroll = () => {
      if (window.scrollY > HOME_SCROLL_REVEAL_PX) setHomeOk(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Chromium: only with install event. iOS: help after delay (no bip).
  const visible =
    eligible &&
    delayDone &&
    homeOk &&
    (installEvent != null || isIosDevice());

  if (!visible) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setCookie("pelbu_pwa_dismiss", "1", 1_209_600);
    setEligible(false);
  }

  async function install() {
    if (!installEvent) {
      setShowIosHelp(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setEligible(false);
    setInstallEvent(null);
  }

  return (
    <aside
      aria-label="Install Pelbu Suites"
      className="fixed inset-x-3 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom,0px))] z-[45] mx-auto max-w-md rounded-2xl border border-cedar-ink/10 bg-forest p-4 text-ivory shadow-2xl md:bottom-6 md:z-[80]"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full text-ivory/70 hover:bg-white/10 hover:text-ivory"
        aria-label="Dismiss install prompt"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-10">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember text-cedar-ink">
          <Download className="size-5" />
        </div>
        <div>
          <p className="font-medium text-white">Keep Pelbu close</p>
          <p className="mt-1 text-sm leading-5 text-ivory/75">
            Install for quicker booking, ordering and stay planning.
          </p>
        </div>
      </div>
      {showIosHelp ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
          <Share className="size-4 shrink-0" />
          In Safari, tap Share, then Add to Home Screen.
        </p>
      ) : null}
      <button
        type="button"
        onClick={install}
        className="mt-4 min-h-11 w-full rounded-xl bg-gradient-to-r from-ember-soft to-ember px-4 text-sm font-semibold text-cedar-ink transition hover:brightness-105"
      >
        Install Pelbu Suites
      </button>
    </aside>
  );
}
