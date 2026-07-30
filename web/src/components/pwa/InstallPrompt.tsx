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

function setCookie(name: string, value: string, maxAge: number): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    if (isStandalone()) {
      setCookie("pelbu_pwa", "public", 31_536_000);
      return;
    }

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !("MSStream" in window);
    const iosTimer = isIos
      ? window.setTimeout(() => setVisible(true), 0)
      : undefined;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setCookie("pelbu_pwa", "public", 31_536_000);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (iosTimer !== undefined) window.clearTimeout(iosTimer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [pathname]);

  if (!visible) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setCookie("pelbu_pwa_dismiss", "1", 1_209_600);
    setVisible(false);
  }

  async function install() {
    if (!installEvent) {
      setShowIosHelp(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setInstallEvent(null);
  }

  return (
    <aside
      aria-label="Install Pelbu Suites"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-md rounded-2xl border border-white/15 bg-ink p-4 text-ivory shadow-2xl"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-ivory/70 hover:bg-white/10 hover:text-ivory"
        aria-label="Dismiss install prompt"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-8">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-citrus text-ink">
          <Download className="size-5" />
        </div>
        <div>
          <p className="font-medium">Keep Pelbu close</p>
          <p className="mt-1 text-sm leading-5 text-ivory/70">
            Install the app for quicker booking, ordering and stay planning.
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
        className="mt-4 min-h-11 w-full rounded-xl bg-citrus px-4 text-sm font-semibold text-espresso transition hover:brightness-95"
      >
        Install Pelbu Suites
      </button>
    </aside>
  );
}
