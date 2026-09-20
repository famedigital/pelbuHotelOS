import type { ReactNode } from "react";

export const metadata = {
  title: "POS till | Pelbu OS",
  robots: { index: false, follow: false },
};

export default function PosKioskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="erp flex min-h-dvh flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
