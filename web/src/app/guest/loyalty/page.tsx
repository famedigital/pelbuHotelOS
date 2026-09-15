import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const metadata = {
  title: "Loyalty",
  description: "Look up your Pelbu Suites loyalty points balance.",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ phone?: string }>;
};

export default async function GuestLoyaltyPortalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const phone = (sp.phone ?? "").replace(/\s+/g, "").trim();

  let account: {
    display_name: string | null;
    points_balance: number;
    tier: string;
  } | null = null;

  if (phone.length >= 7) {
    const admin = createSupabaseAdminClient();
    const { data: property } = await admin
      .from("properties")
      .select("id")
      .eq("slug", DEFAULT_PROPERTY_SLUG)
      .maybeSingle();
    if (property) {
      const { data } = await admin
        .from("guest_loyalty_accounts")
        .select("display_name, points_balance, tier")
        .eq("property_id", property.id as string)
        .eq("contact_phone", phone)
        .maybeSingle();
      if (data) {
        account = {
          display_name: (data.display_name as string | null) ?? null,
          points_balance: Number(data.points_balance),
          tier: data.tier as string,
        };
      }
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-md px-4 py-12">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Pelbu Suites
      </p>
      <h1 className="mt-2 font-display text-3xl text-foreground">
        Loyalty balance
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the phone number used at stay. Points earn 1 per 10 BTN when
        desk posts checkout earn.
      </p>

      <form className="mt-8 space-y-4" method="get">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={sp.phone ?? ""}
            placeholder="+975…"
            required
          />
        </div>
        <Button type="submit" className="h-11 w-full">
          Look up
        </Button>
      </form>

      {phone && !account ? (
        <p className="mt-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          No loyalty account for that phone yet. Ask the desk after your next
          stay.
        </p>
      ) : null}

      {account ? (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {account.display_name || phone}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {account.points_balance}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              points
            </span>
          </p>
          <p className="mt-1 capitalize text-sm text-muted-foreground">
            {account.tier} tier
          </p>
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
