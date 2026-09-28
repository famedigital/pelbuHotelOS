/** Public marketing photography — hospitality only (no software UI / infographics). */
export type MarketingMedia = {
  src: string;
  alt: string;
};

export const MARKETING_MEDIA = {
  heroLobby: {
    src: "/marketing/hero-lobby.jpg",
    alt: "Receptionist in a kira behind the desk of a Bhutan hotel lobby",
  },
  staffDesk: {
    src: "/marketing/staff-front-desk.jpg",
    alt: "Front-desk receptionist serving from behind the counter",
  },
  roomGuest: {
    src: "/marketing/room-guest.jpg",
    alt: "Made guest room with a view of green hills",
  },
  foodFnb: {
    src: "/marketing/food-fnb.jpg",
    alt: "Ema datshi and red rice on a hotel table",
  },
  housekeeping: {
    src: "/marketing/housekeeping.jpg",
    alt: "Housekeeper in a kira setting towels in a guest room",
  },
  howOnboard: {
    src: "/marketing/how-onboard.jpg",
    alt: "Hotelier in a gho checking a guest room with a clipboard",
  },
  howTrain: {
    src: "/marketing/how-train.jpg",
    alt: "Desk team in gho and kira talking through a shift",
  },
  howLive: {
    src: "/marketing/how-live.jpg",
    alt: "Receptionist welcoming two arriving guests with luggage",
  },
  segmentLeased: {
    src: "/marketing/segment-leased.jpg",
    alt: "A row of mid-rise hotels on a Bhutan town street",
  },
  segmentIndependent: {
    src: "/marketing/segment-independent.jpg",
    alt: "A four-storey independent hotel in a Bhutan valley",
  },
  segmentChain: {
    src: "/marketing/segment-chain.jpg",
    alt: "A larger city hotel with traditional wooden windows",
  },
  kitchenPass: {
    src: "/marketing/kitchen-pass.jpg",
    alt: "Cook in a gho plating at the kitchen pass",
  },
} as const satisfies Record<string, MarketingMedia>;
