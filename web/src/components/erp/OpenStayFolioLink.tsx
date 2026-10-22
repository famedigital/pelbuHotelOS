"use client";

import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import type { StayHubStepId } from "@/lib/folio/stay-hub-cycle";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Money and department boards open the stay card.
 * The folio page remains the print/statement surface when no booking is known.
 */
export function OpenStayFolioLink({
  bookingId,
  folioId,
  step = "stay_money",
  className,
  children,
}: {
  bookingId?: string | null;
  folioId?: string | null;
  step?: StayHubStepId;
  className?: string;
  children: ReactNode;
}) {
  const stayHub = useStayHubOptional();

  if (bookingId && stayHub) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          stayHub.openStayHub({ bookingId, step });
        }}
      >
        {children}
      </button>
    );
  }

  if (!folioId) return null;

  return (
    <Link
      href={`/erp/folios/${folioId}`}
      className={className}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
