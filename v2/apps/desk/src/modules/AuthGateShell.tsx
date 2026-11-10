import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { InnoraLogo } from "@hos-v2/ui";
import "../styles/auth-gate.css";

type AuthGateShellProps = {
  kicker: string;
  title: string;
  lead: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional photo under the veil — defaults to night lobby. */
  photoSrc?: string;
  /** Desktop right-side atmosphere copy (hotel premium). */
  atmosphere?: { title: string; lead: string };
  badge?: string;
};

/** Forced dark luxury auth frame — does not inherit light desk ERP tokens. */
export function AuthGateShell({
  kicker,
  title,
  lead,
  children,
  footer,
  photoSrc = "/auth/night.png",
  atmosphere,
  badge = "Sovereign desk · Live",
}: AuthGateShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function onPanelPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduceMotion.current) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--spot-x", `${x}%`);
    el.style.setProperty("--spot-y", `${y}%`);
  }

  return (
    <div className="auth-gate" data-theme="auth-dark">
      <div className="auth-gate-photo" aria-hidden="true">
        <img src={photoSrc} alt="" width={1920} height={1080} decoding="async" fetchPriority="high" />
      </div>
      <div className="auth-gate-veil" aria-hidden="true" />

      {atmosphere ? (
        <aside className="auth-gate-meta" aria-hidden="true">
          <p className="auth-gate-meta-title">{atmosphere.title}</p>
          <p className="auth-gate-meta-lead">{atmosphere.lead}</p>
        </aside>
      ) : null}

      <div
        ref={panelRef}
        className="auth-gate-panel"
        onPointerMove={onPanelPointerMove}
        style={{ "--spot-x": "42%", "--spot-y": "18%" } as CSSProperties}
      >
        <div className="auth-gate-stagger">
          <div className="auth-gate-brand">
            <InnoraLogo size="md" showText tagline="Hotel OS" variant="sovereign" />
          </div>
          <p className="auth-gate-badge">
            <span className="auth-gate-badge-dot" aria-hidden="true" />
            {badge}
          </p>
          <p className="auth-gate-kicker">{kicker}</p>
          <h1 className="auth-gate-title">{title}</h1>
          <p className="auth-gate-lead">{lead}</p>
          {children}
          {footer}
          <p className="auth-gate-foot">
            <span>desk.innorahotel.com</span>
            <span>Bhutan · Nu</span>
          </p>
        </div>
      </div>
    </div>
  );
}
