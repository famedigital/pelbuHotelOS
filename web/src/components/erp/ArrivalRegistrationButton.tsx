"use client";

import {
  fetchRoomingList,
  type RoomingListPayload,
} from "@/app/actions/erp-reservations-party";
import {
  fetchStayHubCatalog,
  fetchStayHubPartyContext,
  fetchStayHubSummary,
  type StayHubSummary,
} from "@/app/actions/stay-hub";
import {
  GuestRegistrationCard,
  type GuestRegistrationCardData,
  type GuestRegistrationPropertyBits,
} from "@/components/erp/GuestRegistrationCard";
import { PartyRegistrationSheet } from "@/components/erp/PartyRegistrationSheet";
import { printDeskSheet } from "@/lib/desk-print";
import type { PropertyRegistrationDesign } from "@/lib/property-settings";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

function cardFromSummary(summary: StayHubSummary): GuestRegistrationCardData {
  const cin = (summary.checkIn ?? "").slice(0, 10);
  const cout = (summary.checkOut ?? "").slice(0, 10);
  const t0 = new Date(`${cin}T12:00:00`).getTime();
  const t1 = new Date(`${cout}T12:00:00`).getTime();
  const nights =
    Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0
      ? Math.round((t1 - t0) / 86_400_000)
      : 1;
  const roomName =
    [summary.roomLabel, summary.roomTypeName].filter(Boolean).join(" · ") ||
    "Room";
  const lead = summary.guests.find((guest) => guest.fullName?.trim()) ?? null;
  return {
    bookingId: summary.bookingId,
    confirmationCode: summary.confirmationCode ?? undefined,
    guestName: lead?.fullName.trim() || summary.contactName?.trim() || "Guest",
    guestPhone: summary.contactPhone || undefined,
    guestOrigin: summary.guestOrigin || undefined,
    passportOrCid: lead?.passportOrCid || undefined,
    guideNumber: summary.guideNumber || undefined,
    agentLabel: summary.agentName || undefined,
    checkIn: cin,
    checkOut: cout,
    nights,
    adults: Math.max(1, summary.adults || 1),
    children: Math.max(0, summary.children || 0),
    extraBeds: Math.max(0, summary.extraBeds || 0),
    mealPlanCode: summary.mealPlanCode || undefined,
    roomLines: [{ name: roomName, qty: Math.max(1, summary.rooms || 1) }],
    rateNightlyBtn: summary.agreedNightlyRateBtn,
    stayTotalBtn: summary.quotedTotalBtn,
  };
}

type PrintPack = {
  design: PropertyRegistrationDesign;
  property: GuestRegistrationPropertyBits;
  card: GuestRegistrationCardData;
  rooming: RoomingListPayload | null;
  agentLabel: string | null;
  guideNumber: string | null;
  confirmationCode: string | null;
};

export function ArrivalRegistrationButton({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const [pack, setPack] = useState<PrintPack | null>(null);

  useEffect(() => {
    if (!pack) return;
    const frame = window.requestAnimationFrame(() => {
      printDeskSheet(pack.rooming ? "reg-party" : "reg");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pack]);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
        onClick={() => {
          startTransition(async () => {
            const [summary, catalog, party] = await Promise.all([
              fetchStayHubSummary(bookingId),
              fetchStayHubCatalog(),
              fetchStayHubPartyContext(bookingId),
            ]);
            if (!summary.ok) {
              toast.error(summary.error ?? "Could not load registration");
              return;
            }
            if (!catalog.ok) {
              toast.error(catalog.error ?? "Could not load registration");
              return;
            }
            const isParty =
              party.ok &&
              (party.data.members.length > 1 || Boolean(party.data.groupId));
            let rooming: RoomingListPayload | null = null;
            if (isParty) {
              const list = await fetchRoomingList(bookingId);
              if (list.ok && list.data.lines.length > 1) rooming = list.data;
            }
            setPack({
              design: catalog.data.registration.design,
              property: catalog.data.registration.property,
              card: cardFromSummary(summary.data),
              rooming,
              agentLabel: summary.data.agentName,
              guideNumber: summary.data.guideNumber,
              confirmationCode: summary.data.confirmationCode,
            });
          });
        }}
      >
        {pending ? "Printing…" : "Registration"}
      </button>
      {pack ? (
        <div className="pointer-events-none absolute left-[-10000px] top-0">
          {pack.rooming ? (
            <PartyRegistrationSheet
              rooming={pack.rooming}
              agentLabel={pack.agentLabel}
              guideNumber={pack.guideNumber}
              confirmationCode={pack.confirmationCode}
              property={pack.property}
              design={pack.design}
            />
          ) : (
            <GuestRegistrationCard
              data={pack.card}
              property={pack.property}
              design={pack.design}
            />
          )}
        </div>
      ) : null}
    </>
  );
}
