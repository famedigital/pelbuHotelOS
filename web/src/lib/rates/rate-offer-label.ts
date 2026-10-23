export type RateOfferView = {
  id: string;
  label: string;
  agentName?: string | null;
  guestLabel?: string | null;
  rateTier: string;
  amountBtn: number;
};

export function offerListLabel(offer: RateOfferView): string {
  const who =
    offer.agentName?.trim() ||
    offer.guestLabel?.trim() ||
    offer.rateTier.replace(/_/g, " ");
  const name =
    offer.label.trim().toLowerCase() === "standard"
      ? who
      : `${who} · ${offer.label.trim()}`;
  return `${name} · Nu ${Math.round(offer.amountBtn).toLocaleString()}`;
}
