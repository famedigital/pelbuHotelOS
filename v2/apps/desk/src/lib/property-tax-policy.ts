/**
 * Property-level SC / GST switches.
 * Default GST OFF — new license / not yet eligible (Pelbu-style).
 * Rates, folio, and F&B should all read this — not hardcode BST.
 */

const SC_RATE = 0.1;
const GST_RATE = 0.1;

export type PropertyTaxPolicy = {
  /** 10% service charge on base */
  scOn: boolean;
  /** GST/BST — off until hotel is eligible */
  gstOn: boolean;
};

let policy: PropertyTaxPolicy = {
  scOn: true,
  gstOn: false,
};

export function getPropertyTaxPolicy(): PropertyTaxPolicy {
  return { ...policy };
}

export function setPropertyTaxPolicy(patch: Partial<PropertyTaxPolicy>): PropertyTaxPolicy {
  policy = {
    scOn: patch.scOn ?? policy.scOn,
    gstOn: patch.gstOn ?? policy.gstOn,
  };
  return getPropertyTaxPolicy();
}

export function propertyTaxBreakdown(net: number): {
  netAmount: number;
  scAmount: number;
  bstAmount: number;
  totalAmount: number;
} {
  const netAmount = Math.max(0, Math.round(net));
  const scAmount = policy.scOn ? Math.round(netAmount * SC_RATE) : 0;
  const bstAmount = policy.gstOn
    ? Math.round((netAmount + scAmount) * GST_RATE)
    : 0;
  return {
    netAmount,
    scAmount,
    bstAmount,
    totalAmount: netAmount + scAmount + bstAmount,
  };
}
