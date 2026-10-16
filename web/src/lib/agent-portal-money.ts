import { thimphuToday } from "@/lib/erp-lists";
import {
  loadAgentCommerceDetail,
  type AgentCommerceDetail,
} from "@/lib/reports/catalog";
import type { AgentPropertyLink } from "@/lib/erp/agent-property-links";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function monthStartIso(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/** Default money window: year-to-date through today (Thimphu). */
export function defaultAgentMoneyRange(today = thimphuToday()): {
  from: string;
  to: string;
} {
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

export type AgentHotelMoney = {
  propertyId: string;
  propertyName: string;
  detail: AgentCommerceDetail | null;
};

export type AgentMoneyCockpit = {
  from: string;
  to: string;
  today: string;
  hotels: AgentHotelMoney[];
  rollup: {
    stays: number;
    room_nights: number;
    quoted_btn: number;
    paid_btn: number;
    outstanding_btn: number;
    credit_used: number;
  };
};

/** Load commerce detail for every MoU-linked hotel. */
export async function loadAgentMoneyCockpit(
  admin: Admin,
  opts: {
    agentId: string;
    links: AgentPropertyLink[];
    from?: string;
    to?: string;
    /** When set, refuses to load another agent's id (portal hardening). */
    sessionAgentId?: string;
  },
): Promise<AgentMoneyCockpit> {
  if (opts.sessionAgentId && opts.sessionAgentId !== opts.agentId) {
    throw new Error("Partner portal may only load your own records.");
  }
  const today = thimphuToday();
  const range = defaultAgentMoneyRange(today);
  const from = opts.from ?? range.from;
  const to = opts.to ?? range.to;

  const hotels: AgentHotelMoney[] = [];
  for (const link of opts.links) {
    const detail = await loadAgentCommerceDetail(admin, {
      propertyId: link.propertyId,
      agentId: opts.agentId,
      from,
      to,
      today,
    });
    hotels.push({
      propertyId: link.propertyId,
      propertyName: link.propertyName,
      detail,
    });
  }

  const rollup = hotels.reduce(
    (acc, h) => {
      const s = h.detail?.summary;
      if (!s) return acc;
      acc.stays += s.stays;
      acc.room_nights += s.room_nights;
      acc.quoted_btn += s.quoted_btn;
      acc.paid_btn += s.paid_btn;
      acc.outstanding_btn += s.outstanding_btn;
      acc.credit_used += s.credit_used;
      return acc;
    },
    {
      stays: 0,
      room_nights: 0,
      quoted_btn: 0,
      paid_btn: 0,
      outstanding_btn: 0,
      credit_used: 0,
    },
  );
  rollup.room_nights = Math.round(rollup.room_nights * 10) / 10;

  return { from, to, today, hotels, rollup };
}

export { monthStartIso };
