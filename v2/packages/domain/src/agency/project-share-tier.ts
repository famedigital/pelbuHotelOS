/** Server-side trip DTO projection by share tier — fail closed (M02). */

import { tripMargin } from "./money.js";
import {
  SHARE_TIERS,
  type AgencyTripRecord,
  type ProjectShareOptions,
  type ShareTier,
} from "./types.js";

function isShareTier(value: string): value is ShareTier {
  return (SHARE_TIERS as readonly string[]).includes(value);
}

export function projectShareTier(
  trip: AgencyTripRecord,
  tier: ShareTier | string,
  options?: ProjectShareOptions,
): Record<string, unknown> {
  if (!isShareTier(tier)) {
    throw new Error("INVALID_SHARE_TIER");
  }

  switch (tier) {
    case "agency":
      return projectAgency(trip);
    case "guest":
      return projectGuest(trip);
    case "guide":
      return projectGuide(trip);
    case "driver":
      return projectDriver(trip);
    case "hotel":
      return projectHotel(trip, options);
    default: {
      const _exhaustive: never = tier;
      throw new Error(`INVALID_SHARE_TIER:${String(_exhaustive)}`);
    }
  }
}

function projectAgency(trip: AgencyTripRecord): Record<string, unknown> {
  return {
    id: trip.id,
    code: trip.code,
    clientName: trip.clientName,
    paxAdults: trip.paxAdults,
    paxChildren: trip.paxChildren,
    dietaryNotes: trip.dietaryNotes,
    arrivalFlight: trip.arrivalFlight,
    days: trip.days.map((d) => ({ ...d })),
    stays: trip.stays.map((s) => ({ ...s })),
    staff: { ...trip.staff },
    budgetLines: trip.budgetLines.map((l) => ({ ...l })),
    clientGrossSellChh: trip.clientGrossSellChh,
    sdfTotalChh: trip.sdfTotalChh,
    passportDocUrls: [...trip.passportDocUrls],
    margin: tripMargin({
      lines: trip.budgetLines,
      sellChh: trip.clientGrossSellChh ?? undefined,
    }),
  };
}

function projectGuest(trip: AgencyTripRecord): Record<string, unknown> {
  return {
    code: trip.code,
    clientName: trip.clientName,
    paxAdults: trip.paxAdults,
    paxChildren: trip.paxChildren,
    dietaryNotes: trip.dietaryNotes,
    arrivalFlight: trip.arrivalFlight,
    days: trip.days.map((d) => ({
      dayIndex: d.dayIndex,
      date: d.date,
      title: d.title,
      narrative: d.narrative,
    })),
    stays: trip.stays.map((s) => ({
      propertyName: s.propertyName,
      roomTypeName: s.roomTypeName,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      mealPlan: s.mealPlan,
    })),
    staff: {
      guideName: trip.staff.guideName,
    },
  };
}

function projectGuide(trip: AgencyTripRecord): Record<string, unknown> {
  return {
    code: trip.code,
    clientName: trip.clientName,
    paxAdults: trip.paxAdults,
    paxChildren: trip.paxChildren,
    dietaryNotes: trip.dietaryNotes,
    arrivalFlight: trip.arrivalFlight,
    days: trip.days.map((d) => ({
      dayIndex: d.dayIndex,
      date: d.date,
      title: d.title,
      narrative: d.narrative,
      overnightDzongkhag: d.overnightDzongkhag,
    })),
    stays: trip.stays.map((s) => ({
      propertyName: s.propertyName,
      roomTypeName: s.roomTypeName,
      roomNumbers: [...s.roomNumbers],
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      mealPlan: s.mealPlan,
    })),
    staff: {
      guideName: trip.staff.guideName,
      guidePhone: trip.staff.guidePhone,
      driverName: trip.staff.driverName,
      driverPhone: trip.staff.driverPhone,
      vehiclePlate: trip.staff.vehiclePlate,
    },
  };
}

function projectDriver(trip: AgencyTripRecord): Record<string, unknown> {
  return {
    code: trip.code,
    paxAdults: trip.paxAdults,
    paxChildren: trip.paxChildren,
    arrivalFlight: trip.arrivalFlight,
    days: trip.days.map((d) => ({
      dayIndex: d.dayIndex,
      date: d.date,
      title: d.title,
    })),
    stays: trip.stays.map((s) => ({
      propertyName: s.propertyName,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
    })),
    staff: {
      driverName: trip.staff.driverName,
      driverPhone: trip.staff.driverPhone,
      vehiclePlate: trip.staff.vehiclePlate,
      guideName: trip.staff.guideName,
      guidePhone: trip.staff.guidePhone,
    },
  };
}

function projectHotel(
  trip: AgencyTripRecord,
  options?: ProjectShareOptions,
): Record<string, unknown> {
  const hideRates = options?.hideRates !== false;
  const filterId = options?.propertyIdFilter;
  const stays = filterId
    ? trip.stays.filter((s) => s.propertyId === filterId)
    : trip.stays;

  return {
    code: trip.code,
    clientName: trip.clientName,
    paxAdults: trip.paxAdults,
    paxChildren: trip.paxChildren,
    dietaryNotes: trip.dietaryNotes,
    stays: stays.map((s) => {
      const row: Record<string, unknown> = {
        propertyName: s.propertyName,
        roomTypeName: s.roomTypeName,
        roomNumbers: [...s.roomNumbers],
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        mealPlan: s.mealPlan,
      };
      if (!hideRates) {
        row.nightlyNetRateChh = s.nightlyNetRateChh;
      }
      return row;
    }),
    staff: {
      guideName: trip.staff.guideName,
      guidePhone: trip.staff.guidePhone,
    },
  };
}
