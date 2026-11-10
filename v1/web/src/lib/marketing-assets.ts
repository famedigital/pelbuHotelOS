/** Public marketing photography and product stills. */
export type MarketingMedia = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export const MARKETING_MEDIA = {
  heroLobby: {
    src: "/marketing/cast/lobby.png",
    alt: "Receptionist in a gold tego and striped kira at a Bhutan hotel desk",
  },
  staffDesk: {
    src: "/marketing/cast/desk-man.png",
    alt: "A young general manager in a knee-length gho",
  },
  roomGuest: {
    src: "/marketing/places/room.png",
    alt: "A quiet hotel bedroom with a timber bed and sheer curtains",
  },
  owner: {
    src: "/marketing/cast/owner.png",
    alt: "A young hotel owner in a kira at a laptop",
  },
  placeLobby: {
    src: "/marketing/places/lobby.png",
    alt: "A Bhutan hotel lounge with timber windows and mountains",
  },
  placeDining: {
    src: "/marketing/places/dining.png",
    alt: "A hotel dining room with timber tables and red runners",
  },
  foodFnb: {
    src: "/marketing/cast/team-fnb.png",
    alt: "Food and beverage team in tego and gho, cook in a white jacket",
  },
  housekeeping: {
    src: "/marketing/cast/team-hk.png",
    alt: "Housekeeping team, men and women together, with a linen trolley",
  },
  howOnboard: {
    src: "/marketing/places/lobby.png",
    alt: "A Bhutan hotel lounge with timber windows and mountains",
  },
  eveningHotel: {
    src: "/marketing/places/night.png",
    alt: "Hillside hotel lodges lit at dusk among pine trees",
  },
  howTrain: {
    src: "/marketing/places/dining.png",
    alt: "A hotel dining room with timber tables and red runners",
  },
  howLive: {
    src: "/marketing/places/room.png",
    alt: "A quiet hotel bedroom with a timber bed and sheer curtains",
  },
  segmentLeased: {
    src: "/marketing/segment-leased.png",
    alt: "Several timber lodges with green roofs on a pine hillside at dusk",
  },
  segmentIndependent: {
    src: "/marketing/segment-independent.png",
    alt: "One white courtyard hotel with a timber balcony at dusk",
  },
  segmentChain: {
    src: "/marketing/segment-chain.png",
    alt: "A larger Bhutan hotel with linked wings and a formal entrance",
  },
  kitchenPass: {
    src: "/marketing/cast/cook.png",
    alt: "Cook in a white kitchen jacket plating at the pass",
  },
  teamFrontOffice: {
    src: "/marketing/cast/team-fo.png",
    alt: "Front office team in mustard tego, blue cuffs, and check kira",
  },
  teamHousekeeping: {
    src: "/marketing/cast/team-hk.png",
    alt: "Housekeeping team, men and women together, with a linen trolley",
  },
  teamFnb: {
    src: "/marketing/cast/team-fnb.png",
    alt: "Food and beverage team in tego and gho, cook in a white jacket",
  },
  screenDesk: {
    src: "/marketing/screens/desk.png",
    alt: "Innora manager duty board",
    width: 1440,
    height: 900,
  },
  screenToday: {
    src: "/marketing/screens/today.png",
    alt: "Innora front desk today screen",
    width: 1440,
    height: 468,
  },
  screenArrivals: {
    src: "/marketing/screens/arrivals.png",
    alt: "Innora arrivals list",
    width: 1440,
    height: 900,
  },
  screenPos: {
    src: "/marketing/screens/pos.png",
    alt: "Innora point of sale, table room or counter",
    width: 1440,
    height: 520,
  },
  screenNight: {
    src: "/marketing/screens/night-audit.png",
    alt: "Innora night audit close day",
    width: 1440,
    height: 900,
  },
  storyAgent: {
    src: "/marketing/story/agent-desk.png",
    alt: "A receptionist at the Innora desk while an agent checks a voucher",
  },
  storyArrival: {
    src: "/marketing/story/arrival.png",
    alt: "A guide, a driver, and hotel staff meeting a group at the porch",
  },
  storyKitchen: {
    src: "/marketing/story/kitchen.png",
    alt: "A cook sorting vegetables while a gas cylinder is wheeled in",
  },
  storyInspection: {
    src: "/marketing/story/inspection.png",
    alt: "A manager marking a paper checklist at a hotel desk",
  },
  teamMaintenance: {
    src: "/marketing/cast/team-maint.png",
    alt: "Maintenance team in work clothes with a toolbox and ladder",
  },
} as const satisfies Record<string, MarketingMedia>;
