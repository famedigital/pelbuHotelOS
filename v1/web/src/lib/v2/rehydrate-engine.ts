import { useRamEngine, type DeskSnapshot } from "@hotel-os/engine";
import { fetchDeskSnapshotJson, readV2DeskToken } from "@/lib/v2/desk-api";

/**
 * Pulls a fresh `/v1/desk/snapshot` after a successful money/stay mutation so the
 * Zustand + Dexie engine matches Postgres.
 */
export async function refreshV2DeskEngine(): Promise<void> {
  const token = readV2DeskToken();
  if (!token) {
    throw new Error("No v2 desk JWT — sign in on /v2 with staff PIN.");
  }
  const raw = await fetchDeskSnapshotJson(token);
  await useRamEngine.getState().hydrateEngine(raw as unknown as DeskSnapshot);
}
