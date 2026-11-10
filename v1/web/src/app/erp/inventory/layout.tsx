import { InventoryHub } from "@/components/erp/inventory/InventoryHub";
import type { ReactNode } from "react";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return <InventoryHub>{children}</InventoryHub>;
}
