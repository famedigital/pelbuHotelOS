import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { cache } from "react";

function platformEmailAllowlist(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type PlatformAdminSession = {
  email: string;
  userId: string;
  role: "owner" | "ops";
  via: "env" | "table";
};

export const getPlatformAdminSession = cache(
  async (): Promise<PlatformAdminSession | null> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const email = user?.email?.trim().toLowerCase();
      if (!user || !email) return null;

      if (platformEmailAllowlist().has(email)) {
        return { email, userId: user.id, role: "owner", via: "env" };
      }

      const admin = createSupabaseAdminClient();
      const { data: row } = await admin
        .from("platform_admins")
        .select("email, role")
        .ilike("email", email)
        .maybeSingle();
      if (!row) return null;
      return {
        email,
        userId: user.id,
        role: (row.role as "owner" | "ops") ?? "ops",
        via: "table",
      };
    } catch {
      return null;
    }
  },
);

export async function requirePlatformAdmin(): Promise<PlatformAdminSession> {
  const session = await getPlatformAdminSession();
  if (!session) {
    throw new Error("UNAUTHORIZED_PLATFORM_ADMIN");
  }
  return session;
}

export type DistributorSession = {
  email: string;
  userId: string;
  distributorId: string;
  distributorName: string;
  role: "owner" | "ops";
};

export const getDistributorSession = cache(
  async (): Promise<DistributorSession | null> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const email = user?.email?.trim().toLowerCase();
      if (!user || !email) return null;

      const admin = createSupabaseAdminClient();
      const { data: member } = await admin
        .from("distributor_members")
        .select("distributor_id, role, distributors(id, name, status)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) {
        const { data: byEmail } = await admin
          .from("distributor_members")
          .select("distributor_id, role, user_id, distributors(id, name, status)")
          .ilike("email", email)
          .maybeSingle();
        if (!byEmail) return null;
        const dist = byEmail.distributors as unknown as {
          id: string;
          name: string;
          status: string;
        } | null;
        if (!dist || dist.status === "suspended") return null;
        return {
          email,
          userId: user.id,
          distributorId: byEmail.distributor_id as string,
          distributorName: dist.name,
          role: (byEmail.role as "owner" | "ops") ?? "ops",
        };
      }

      const dist = member.distributors as unknown as {
        id: string;
        name: string;
        status: string;
      } | null;
      if (!dist || dist.status === "suspended") return null;
      return {
        email,
        userId: user.id,
        distributorId: member.distributor_id as string,
        distributorName: dist.name,
        role: (member.role as "owner" | "ops") ?? "ops",
      };
    } catch {
      return null;
    }
  },
);

export async function requireDistributor(): Promise<DistributorSession> {
  const session = await getDistributorSession();
  if (!session) throw new Error("UNAUTHORIZED_DISTRIBUTOR");
  return session;
}

/** Cookie used when platform/partner enters a hotel desk for support. */
export const SUPPORT_PROPERTY_COOKIE = "hotelos_support_property";

export async function setSupportPropertyCookie(propertyId: string) {
  const jar = await cookies();
  jar.set(SUPPORT_PROPERTY_COOKIE, propertyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });
}
