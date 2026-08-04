import "server-only";

import { cookies } from "next/headers";
import {
  AGENT_RATE_VIEW_TTL_MS,
  createAgentRateViewToken,
  parseAgentRateViewToken,
  type AgentRateViewSession,
} from "@/lib/agent-rate-view-token";

export const AGENT_RATE_VIEW_COOKIE = "pelbu_agent_rate_view";

export type { AgentRateViewSession };
export {
  AGENT_RATE_VIEW_TTL_MS,
  createAgentRateViewToken,
  parseAgentRateViewToken,
} from "@/lib/agent-rate-view-token";

export async function readAgentRateViewSession(
  propertyId: string,
): Promise<AgentRateViewSession | null> {
  const jar = await cookies();
  const session = parseAgentRateViewToken(
    jar.get(AGENT_RATE_VIEW_COOKIE)?.value,
  );
  if (!session || session.propertyId !== propertyId) return null;
  return session;
}

export async function setAgentRateViewCookie(
  propertyId: string,
  email: string,
): Promise<void> {
  const token = createAgentRateViewToken(propertyId, email);
  const jar = await cookies();
  jar.set(AGENT_RATE_VIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/rates",
    maxAge: Math.floor(AGENT_RATE_VIEW_TTL_MS / 1000),
  });
}
