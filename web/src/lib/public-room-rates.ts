import "server-only";

import type { PublicRoom } from "@/lib/public-content";
import { loadPublicRooms } from "@/lib/public-content";
import {
  loadPublicRateCard,
  seasonLabel,
  type SeasonKind,
} from "@/lib/rate-card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";

export type PublicRoomWithRate = PublicRoom & {
  /** Room-only rack for the current Thimphu season, when published. */
  fromPriceBtn: number | null;
};

export type PublicRoomRateContext = {
  rooms: PublicRoomWithRate[];
  /** Lowest current-season room-only rate across sellable guest rooms. */
  lowestFromBtn: number | null;
  seasonKind: SeasonKind | null;
  seasonName: string | null;
  taxInclusive: boolean;
};

/**
 * Guest rooms with public BAR room-only “from” prices for the active season.
 * Never invents money — missing rates stay null.
 */
export async function loadPublicRoomsWithRates(): Promise<PublicRoomRateContext> {
  const empty: PublicRoomRateContext = {
    rooms: [],
    lowestFromBtn: null,
    seasonKind: null,
    seasonName: null,
    taxInclusive: false,
  };

  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return empty;

  const admin = createSupabaseAdminClient();
  const [rooms, card] = await Promise.all([
    loadPublicRooms(),
    loadPublicRateCard(admin, propertyId),
  ]);

  if (!card) {
    return {
      ...empty,
      rooms: rooms.map((room) => ({ ...room, fromPriceBtn: null })),
    };
  }

  const season = card.currentSeasonKind;
  const byCode = new Map(
    card.publicTier.rooms.map((row) => [row.code, row.amounts[season] ?? null]),
  );

  const withRates: PublicRoomWithRate[] = rooms.map((room) => {
    const amount = byCode.get(room.code);
    return {
      ...room,
      fromPriceBtn:
        typeof amount === "number" && Number.isFinite(amount) && amount > 0
          ? amount
          : null,
    };
  });

  const priced = withRates
    .map((room) => room.fromPriceBtn)
    .filter((n): n is number => n != null && n > 0);

  return {
    rooms: withRates,
    lowestFromBtn: priced.length ? Math.min(...priced) : null,
    seasonKind: season,
    seasonName: seasonLabel(season),
    taxInclusive: card.inclusiveOfGstSc,
  };
}
