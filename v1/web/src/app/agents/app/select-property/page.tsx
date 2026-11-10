import { setAgentActiveProperty } from "@/app/actions/agent-auth";
import { requireAgentSession } from "@/lib/agent-auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentSelectPropertyPage() {
  const session = await requireAgentSession();

  if (session.links.length === 1) {
    redirect("/agents/app");
  }
  if (session.activePropertyId && session.links.length > 1) {
    // Allow switching by visiting this page intentionally.
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          Innora Partner
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Choose a hotel
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.companyName} — hotels with a signed MoU. Rates and inventory
          open only for those properties.
        </p>
      </div>
      <ul className="space-y-2">
        {session.links.map((link) => (
          <li key={link.propertyId}>
            <form action={setAgentActiveProperty}>
              <input type="hidden" name="property_id" value={link.propertyId} />
              <Button
                type="submit"
                variant={
                  session.activePropertyId === link.propertyId
                    ? "default"
                    : "outline"
                }
                className="h-auto w-full justify-between px-4 py-3 text-left"
              >
                <span>
                  <span className="block font-medium">{link.propertyName}</span>
                  <span className="block text-xs font-normal opacity-80">
                    {link.rateTier.replace(/_/g, " ")} · credit{" "}
                    {Math.max(0, link.creditLimit - link.creditUsed).toLocaleString()}{" "}
                    available
                  </span>
                </span>
                <span className="text-xs uppercase tracking-wide">
                  {session.activePropertyId === link.propertyId
                    ? "Current"
                    : "Open"}
                </span>
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
