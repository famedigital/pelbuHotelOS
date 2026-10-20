import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Stays",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Stays hub home → Arrivals tab */
export default async function StaysHubPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  redirect("/erp/arrivals");
}
