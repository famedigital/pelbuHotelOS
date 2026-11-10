import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy `/agents/app/book` → hub New booking tab. */
export default function AgentBookRedirectPage() {
  redirect("/agents/app/stays?tab=new");
}
