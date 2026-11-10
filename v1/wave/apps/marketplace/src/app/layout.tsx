import type { ReactNode } from "react";

export const metadata = {
  title: "Stay Bhutan · Hotel OS Marketplace",
  description: "National multi-hotel live inventory exchange",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Georgia, 'Times New Roman', serif",
          background: "linear-gradient(160deg,#0f172a,#1e293b 40%,#0ea5e9)",
          color: "#f8fafc",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
