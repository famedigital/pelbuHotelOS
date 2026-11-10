import type { ReactNode } from "react";
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
};

/** Forced dark luxury auth frame — does not inherit light desk ERP tokens. */
export function AuthGateShell({
  kicker,
  title,
  lead,
  children,
  footer,
  photoSrc = "/auth/night.png",
}: AuthGateShellProps) {
  return (
    <div className="auth-gate" data-theme="auth-dark">
      <div className="auth-gate-photo" aria-hidden="true">
        <img src={photoSrc} alt="" width={1920} height={1080} />
      </div>
      <div className="auth-gate-veil" aria-hidden="true" />
      <div className="auth-gate-panel">
        <div className="auth-gate-brand">
          <InnoraLogo size="md" showText tagline="Hotel OS" variant="sovereign" />
        </div>
        <p className="auth-gate-kicker">{kicker}</p>
        <h1 className="auth-gate-title">{title}</h1>
        <p className="auth-gate-lead">{lead}</p>
        {children}
        {footer}
        <p className="auth-gate-foot">desk.innorahotel.com</p>
      </div>
    </div>
  );
}
