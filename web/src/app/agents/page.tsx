import { redirect } from "next/navigation";

export const metadata = {
  title: "Agents",
  robots: { index: false, follow: false },
};

/** Public agents marketing page removed — send partners to sign-in. */
export default function AgentsPage() {
  redirect("/agents/login");
}
