import { getAgentSession } from "@/lib/agent-auth";
import { BRAND_ICONS } from "@/lib/brand";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { getStaffSession } from "@/lib/staff-auth";
import { SITE_NAME } from "@/lib/site";
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  HandshakeIcon,
  ShieldIcon,
  UserRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
  description: "Hotel OS login hub — desk, staff, agents, partners, platform admin.",
  robots: { index: false, follow: false },
};

const WORKSPACES = [
  {
    title: "Hotel desk",
    description: "Reservations, rooms, folios, POS and hotel operations.",
    href: "/erp/login",
    icon: Building2Icon,
  },
  {
    title: "Staff",
    description: "Attendance, rota, notices, leave and payslips.",
    href: "/staff/login",
    icon: UserRoundIcon,
  },
  {
    title: "Travel partner",
    description: "Agent booking workspace.",
    href: "/agents/login",
    icon: BriefcaseBusinessIcon,
  },
  {
    title: "Distributor / partner",
    description: "Onboard hotels, AMC, and support for your clients.",
    href: "/partner/login",
    icon: HandshakeIcon,
  },
  {
    title: "Platform admin",
    description: "Fame Digital — all hotels, royalty, packages.",
    href: "/admin/login",
    icon: ShieldIcon,
  },
] as const;

export default async function LoginHubPage() {
  if (await isDeskAuthenticated()) redirect("/erp");
  const staff = await getStaffSession();
  if (staff) redirect(staff.canAccessDesk ? "/erp" : "/staff");
  if (await getAgentSession()) redirect("/agents/app");

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND_ICONS.mark}
          alt={SITE_NAME}
          width={56}
          height={56}
          className="size-14 rounded-2xl object-contain"
        />
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {SITE_NAME}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Choose your workspace
        </h1>
        <p className="mt-3 leading-6 text-muted-foreground">
          Desk, staff, agents, distributors, and platform admin each have their
          own portal.
        </p>

        <div className="mt-8 grid gap-3">
          {WORKSPACES.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <Link
                key={workspace.href}
                href={workspace.href}
                className="group flex min-h-24 items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{workspace.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {workspace.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
