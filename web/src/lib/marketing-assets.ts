/** Public marketing photography — hospitality only (no software UI / infographics). */
export type MarketingMedia = {
  src: string;
  alt: string;
};

export const MARKETING_MEDIA = {
  heroLobby: {
    src: "/marketing/hero-lobby.jpg",
    alt: "Bright hotel lobby with Himalayan mountain light — Innora for Bhutan hotels",
  },
  staffDesk: {
    src: "/marketing/staff-front-desk.jpg",
    alt: "Bhutanese front desk staff welcoming guests",
  },
  roomGuest: {
    src: "/marketing/room-guest.jpg",
    alt: "Guest room ready for arrival with mountain view",
  },
  foodFnb: {
    src: "/marketing/food-fnb.jpg",
    alt: "Hotel restaurant plated dish",
  },
  housekeeping: {
    src: "/marketing/housekeeping.jpg",
    alt: "Bhutanese housekeeping preparing a guest room",
  },
  howOnboard: {
    src: "/marketing/how-onboard.jpg",
    alt: "Bhutanese hotelier checking a guest room during onboarding",
  },
  howTrain: {
    src: "/marketing/how-train.jpg",
    alt: "Bhutanese desk team training at the front desk",
  },
  howLive: {
    src: "/marketing/how-live.jpg",
    alt: "Bhutanese receptionist welcoming arriving guests",
  },
  segmentLeased: {
    src: "/marketing/segment-leased.jpg",
    alt: "Multiple boutique hotels on Bhutan hillsides",
  },
  segmentIndependent: {
    src: "/marketing/segment-independent.jpg",
    alt: "Independent boutique hotel lodge in a Bhutan valley",
  },
  segmentChain: {
    src: "/marketing/segment-chain.jpg",
    alt: "Larger resort entrance in the Bhutan mountains",
  },
  kitchenPass: {
    src: "/marketing/kitchen-pass.jpg",
    alt: "Bhutanese chef plating hotel restaurant cuisine",
  },
} as const satisfies Record<string, MarketingMedia>;
