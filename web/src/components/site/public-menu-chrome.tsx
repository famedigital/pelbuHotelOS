"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type PublicMenuChromeValue = {
  /** True while scroll-down browsing on /menu (mobile). */
  immersive: boolean;
  /** True when the mobile cart has at least one line. */
  cartActive: boolean;
  setCartActive: (active: boolean) => void;
  /** Hide site header + tab bar on mobile menu. */
  hideChrome: boolean;
};

const PublicMenuChromeContext = createContext<PublicMenuChromeValue | null>(
  null,
);

function isMenuPath(pathname: string) {
  return pathname === "/menu" || pathname.startsWith("/menu/");
}

const LG_MQ = "(min-width: 1024px)";

/**
 * Root-level provider so `/menu` content and `PublicMobileNav` share chrome
 * state. Scroll immersion only applies on menu routes below the `lg` breakpoint.
 */
export function PublicMenuChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onMenu = isMenuPath(pathname);
  const [immersive, setImmersive] = useState(false);
  const [cartActive, setCartActiveState] = useState(false);

  const setCartActive = useCallback((active: boolean) => {
    setCartActiveState(active);
  }, []);

  useEffect(() => {
    if (!onMenu) {
      setImmersive(false);
      setCartActiveState(false);
    }
  }, [onMenu]);

  useEffect(() => {
    if (!onMenu) return;

    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (window.matchMedia(LG_MQ).matches) {
          setImmersive(false);
          lastY = window.scrollY;
          return;
        }
        const y = window.scrollY;
        if (y < 48) {
          setImmersive(false);
        } else if (y > lastY && y > 56) {
          setImmersive(true);
        } else if (y < lastY - 12) {
          setImmersive(false);
        }
        lastY = y;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [onMenu]);

  const hideChrome = onMenu && (immersive || cartActive);

  const value = useMemo(
    () => ({
      immersive: onMenu ? immersive : false,
      cartActive: onMenu ? cartActive : false,
      setCartActive,
      hideChrome,
    }),
    [onMenu, immersive, cartActive, setCartActive, hideChrome],
  );

  return (
    <PublicMenuChromeContext.Provider value={value}>
      {children}
    </PublicMenuChromeContext.Provider>
  );
}

export function usePublicMenuChromeOptional(): PublicMenuChromeValue | null {
  return useContext(PublicMenuChromeContext);
}
