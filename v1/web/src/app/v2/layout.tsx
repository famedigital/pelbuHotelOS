import "@hotel-os/ui/styles.css";
import { V2ShellLayout } from "./v2-shell-layout";

export default function V2RootLayout({ children }: { children: React.ReactNode }) {
  return <V2ShellLayout>{children}</V2ShellLayout>;
}
