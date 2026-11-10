"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRamEngine } from "@hotel-os/engine";
import type { DeskSnapshot } from "@hotel-os/engine";
import {
  fetchDeskSnapshotJson,
  readV2DeskToken,
  readV2Staff,
} from "@/lib/v2/desk-api";

/**
 * After PIN auth, loads `/v1/desk/snapshot` into `@hotel-os/engine` Zustand + Dexie cache.
 */
export function V2DeskSnapshotHydration(): null {
  const hydrateEngine = useRamEngine((s) => s.hydrateEngine);
  const setStaff = useRamEngine((s) => s.setStaff);
  const setSyncState = useRamEngine((s) => s.setSyncState);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const token = readV2DeskToken();
    const staff = readV2Staff();
    if (!token) {
      setSyncState("synced");
      return;
    }
    if (staff) {
      setStaff(staff.id, staff.fullName);
    }

    void (async () => {
      try {
        setSyncState("syncing");
        const raw = await fetchDeskSnapshotJson(token);
        await hydrateEngine(raw as unknown as DeskSnapshot);
      } catch (err) {
        console.error("[V2DeskSnapshotHydration] snapshot failed", { err });
        setSyncState("conflict");
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not load desk snapshot from API.",
        );
      }
    })();
  }, [hydrateEngine, setStaff, setSyncState]);

  return null;
}
