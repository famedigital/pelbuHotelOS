import { HrHub } from "@/components/erp/hr/HrHub";
import type { ReactNode } from "react";

export default function HrLayout({ children }: { children: ReactNode }) {
  return <HrHub>{children}</HrHub>;
}
