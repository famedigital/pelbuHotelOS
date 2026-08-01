import "server-only";
import { getStaffSession } from "@/lib/staff-auth";

/** Desk action attribution — staff name when signed in, else shared desk PIN session. */
export async function resolveDeskActor(): Promise<{
  actor: string;
  staffId: string | null;
}> {
  const staff = await getStaffSession();
  return {
    actor: staff?.fullName ?? "desk",
    staffId: staff?.staffId ?? null,
  };
}
