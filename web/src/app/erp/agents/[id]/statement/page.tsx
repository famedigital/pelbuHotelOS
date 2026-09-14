import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Agent statement | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Legacy statement URL → dossier Money tab. */
export default async function AgentStatementRedirect({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  redirect(`/erp/agents/${id}?tab=money`);
}
