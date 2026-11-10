import { Metadata } from "next";
import { PurchasesManager } from "@/components/purchases/PurchasesManager";

export const metadata: Metadata = {
  title: "Purchases & Expenses · Hotel OS v2",
  description: "Centenary Farmers Market, Utilities, and Cash Till Auto-Deduction Engine.",
  robots: { index: false, follow: false },
};

export default function V2PurchasesPage() {
  return <PurchasesManager variant="api" />;
}
