"use client";

/**
 * Thin adapter: calendar rack edit path uses global StayHub.
 * Kept so older imports keep working; RoomRackGrid prefers openStayHub.
 */
export { StayHubDialog as CalendarReservationEditDialog } from "@/components/erp/StayHubDialog";
