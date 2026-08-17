"use client";

import {
  FastBookVoucher,
  type FastBookVoucherData,
} from "@/components/erp/FastBookVoucher";
import {
  GuestRegistrationCard,
  type GuestRegistrationCardData,
  type GuestRegistrationPropertyBits,
} from "@/components/erp/GuestRegistrationCard";
import type { PropertyRegistrationDesign } from "@/lib/property-settings";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StayHubErrorBoundary } from "@/components/erp/stay-hub/StayHubErrorBoundary";

/**
 * Body-level print sheets for StayHub. Must wait until after mount so SSR
 * and the first client paint match (no `document` during RSC/SSR).
 */
export function StayHubPrintHost({
  voucher,
  registration,
  property,
  design,
}: {
  voucher: FastBookVoucherData;
  registration: GuestRegistrationCardData;
  property?: GuestRegistrationPropertyBits;
  design?: PropertyRegistrationDesign | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <StayHubErrorBoundary fallback={null}>
      <div className="desk-print-host" aria-hidden>
        <FastBookVoucher
          data={voucher}
          property={
            property?.name
              ? {
                  name: property.name,
                  legal_name: property.legal_name,
                  address: property.address,
                  phone: property.phone,
                  email: property.email,
                  tax_id: property.tax_id,
                  logo_public_id: property.logo_public_id,
                }
              : undefined
          }
        />
        <GuestRegistrationCard
          data={registration}
          property={property}
          design={design}
        />
      </div>
    </StayHubErrorBoundary>,
    document.body,
  );
}
