"use client";

import { AgentNameLink } from "@/components/erp/AgentNameLink";
import {
  loadRoomDossier,
  type RoomDossier,
} from "@/app/actions/erp-room-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  unitId: string | null;
  units: RoomMapUnit[];
  onClose: () => void;
};

export function RoomDossierSheet({ unitId, units, onClose }: Props) {
  const [dossier, setDossier] = useState<RoomDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) {
      setDossier(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setDossier(null);
    setError(null);
    setLoading(true);
    void loadRoomDossier(unitId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDossier(res.dossier);
    });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const fallbackLabel =
    units.find((u) => u.id === unitId)?.label ?? dossier?.unit.label;

  return (
    <Sheet
      open={unitId != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Room {fallbackLabel ?? "…"}</SheetTitle>
          <SheetDescription>
            Photos · stay · guests · amenities · issues
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : null}

        {dossier ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{dossier.unit.room_type_name}</Badge>
              <Badge variant="outline">{dossier.unit.hk_status}</Badge>
              {dossier.unit.floor_label ? (
                <Badge variant="outline">Floor {dossier.unit.floor_label}</Badge>
              ) : null}
              {dossier.unit.view_label ? (
                <Badge variant="outline">{dossier.unit.view_label}</Badge>
              ) : null}
              {dossier.unit.facade_side ? (
                <Badge variant="outline">{dossier.unit.facade_side}</Badge>
              ) : null}
              {dossier.unit.has_balcony ? (
                <Badge variant="outline">Balcony</Badge>
              ) : null}
            </div>

            <Tabs defaultValue="now">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="now">Now</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="more">More</TabsTrigger>
              </TabsList>

              <TabsContent value="now" className="mt-3 space-y-3">
                {dossier.current ? (
                  <div className="rounded-lg border bg-card p-3 text-sm">
                    <p className="font-medium text-foreground">
                      {dossier.current.contact_name ?? "Guest"}
                    </p>
                    <p className="text-muted-foreground">
                      {dossier.current.check_in} → {dossier.current.check_out} ·{" "}
                      {dossier.current.status}
                    </p>
                    {dossier.current.agent_name || dossier.current.agent_id ? (
                      <p className="text-muted-foreground">
                        Agent:{" "}
                        <AgentNameLink
                          agentId={dossier.current.agent_id}
                          name={dossier.current.agent_name}
                          className="text-sm"
                        />
                      </p>
                    ) : null}
                    <Link
                      href={`/erp/bookings/${dossier.current.booking_id}`}
                      className="mt-2 inline-block text-xs font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Open booking
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No guest in this room today.
                  </p>
                )}

                {dossier.upcoming.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Upcoming
                    </p>
                    <ul className="space-y-1.5">
                      {dossier.upcoming.map((u) => (
                        <li
                          key={u.booking_id + u.check_in}
                          className="rounded-md border px-2.5 py-1.5 text-sm"
                        >
                          <span className="font-medium">
                            {u.contact_name ?? "Guest"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {u.check_in} → {u.check_out}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {dossier.openProblems.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Flags
                    </p>
                    <ul className="space-y-1">
                      {dossier.openProblems.map((p, i) => (
                        <li
                          key={`${p.kind}-${i}`}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-sm"
                        >
                          {p.summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="photos" className="mt-3">
                {dossier.photoPublicIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No room-type photos tagged yet. Add under Front public →
                    media / room types.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {dossier.photoPublicIds.map((id) => {
                      const src = cloudinaryUrl(id, { width: 400 });
                      if (!src) return null;
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={id}
                          src={src}
                          alt=""
                          className="aspect-[4/3] w-full rounded-md object-cover"
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-3 space-y-2">
                {dossier.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No past stays on this physical room yet.
                  </p>
                ) : (
                  dossier.history.map((h) => (
                    <div
                      key={h.booking_id + h.check_out}
                      className="rounded-md border px-2.5 py-2 text-sm"
                    >
                      <p className="font-medium">
                        {h.contact_name ?? "Guest"}
                      </p>
                      <p className="text-muted-foreground">
                        {h.check_in} → {h.check_out} · {h.status}
                      </p>
                      {h.guest_names.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Guests: {h.guest_names.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="more" className="mt-3 space-y-3">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Amenity PAR (property)
                  </p>
                  {dossier.amenities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No amenity PARs configured.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-2 gap-1 text-sm">
                      {dossier.amenities.map((a) => (
                        <li
                          key={a.name}
                          className="rounded border px-2 py-1 tabular-nums"
                        >
                          {a.name}{" "}
                          <span className="text-muted-foreground">
                            ×{a.par_qty}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/erp/rooms">HK board</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/erp/calendar">Calendar</Link>
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
