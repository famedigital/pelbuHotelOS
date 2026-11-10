import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "SuperAdmin → /admin",
  robots: { index: false, follow: false },
};

/** Canonical SaaS + OTA control plane is `/admin` (hotels, MoU, Hermes, commissions). */
export default function SuperAdminRedirectPage() {
  redirect("/admin/hotels");
  return (
    <p>
      Moved to <Link href="/admin/hotels">/admin/hotels</Link>
    </p>
  );
}
