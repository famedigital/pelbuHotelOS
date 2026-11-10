import { create } from "zustand";

export type Dzongkhag =
  | "Paro"
  | "Thimphu"
  | "Punakha"
  | "Bumthang"
  | "Wangdue"
  | "Haa"
  | "Trashigang";

export type RoomCategory = {
  id: string;
  code: string;
  name: string;
  maxOcc: number;
};

export type FloorDef = {
  id: string;
  label: string;
  sort: number;
};

export type SettingsRoom = {
  id: string;
  number: string;
  floorId: string;
  categoryId: string;
};

type SettingsState = {
  hotelName: string;
  dzongkhag: Dzongkhag;
  tpn: string;
  dotStars: number;
  tradeLicense: string;
  checkInTime: string;
  checkOutTime: string;
  scEnabled: boolean;
  scRate: number;
  tipPoolSharePct: number;
  bstEnabled: boolean;
  bstRate: number;
  /** 2–4 letter hotel code for FN / INV numbers (e.g. DH). Empty → derive from hotelName. */
  hotelInitial: string;
  psbnPrefix: string;
  invPrefix: string;
  /** DRC e-invoice API — staged blocks live fiscal submit. */
  drcEinvoiceStatus: "staged" | "live";
  mbobMerchantId: string;
  mbobQrNote: string;
  bnbAccountName: string;
  bnbAccountNo: string;
  tillFloatLimit: number;
  tillMaxCash: number;
  floors: FloorDef[];
  categories: RoomCategory[];
  rooms: SettingsRoom[];
  hasCompletedHotelOnboarding: boolean;
  hasCompletedStaffTour: boolean;
  isHotelOnboardingOpen: boolean;
  isStaffTourOpen: boolean;
  openHotelOnboarding: () => void;
  closeHotelOnboarding: () => void;
  completeHotelOnboarding: (patch: {
    hotelName: string;
    dzongkhag: Dzongkhag;
    dotStars: number;
    tradeLicense: string;
    tpn: string;
    scEnabled: boolean;
    bstEnabled: boolean;
    roomsCount?: number;
    startingTill?: number;
  }) => void;
  startStaffTour: () => void;
  closeStaffTour: () => void;
  completeStaffTour: () => void;
  updateProfile: (patch: Partial<Pick<SettingsState,
    | "hotelName"
    | "dzongkhag"
    | "tpn"
    | "dotStars"
    | "tradeLicense"
    | "checkInTime"
    | "checkOutTime"
  >>) => void;
  updateFiscal: (patch: Partial<Pick<SettingsState,
    | "scEnabled"
    | "scRate"
    | "tipPoolSharePct"
    | "bstEnabled"
    | "bstRate"
    | "hotelInitial"
    | "psbnPrefix"
    | "invPrefix"
    | "drcEinvoiceStatus"
  >>) => void;
  updatePayments: (patch: Partial<Pick<SettingsState,
    | "mbobMerchantId"
    | "mbobQrNote"
    | "bnbAccountName"
    | "bnbAccountNo"
    | "tillFloatLimit"
    | "tillMaxCash"
  >>) => void;
  addFloor: (label: string) => void;
  addCategory: (code: string, name: string, maxOcc: number) => void;
  addRoom: (number: string, floorId: string, categoryId: string) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  hotelName: "Demo Hotel",
  dzongkhag: "Thimphu",
  tpn: "",
  dotStars: 4,
  tradeLicense: "",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  scEnabled: true,
  scRate: 0.1,
  tipPoolSharePct: 100,
  bstEnabled: false,
  bstRate: 0.1,
  hotelInitial: "DH",
  psbnPrefix: "DHPSBN",
  invPrefix: "DHINV",
  drcEinvoiceStatus: "staged",
  mbobMerchantId: "",
  mbobQrNote: "",
  bnbAccountName: "Demo Hotel",
  bnbAccountNo: "",
  tillFloatLimit: 10000,
  tillMaxCash: 100000,
  floors: [
    { id: "fl-g", label: "Ground", sort: 0 },
    { id: "fl-1", label: "1st Floor", sort: 1 },
    { id: "fl-2", label: "2nd Floor", sort: 2 },
    { id: "fl-3", label: "3rd Floor", sort: 3 },
  ],
  categories: [
    { id: "cat-dq", code: "deluxe_queen", name: "Deluxe Queen", maxOcc: 2 },
    { id: "cat-dk", code: "deluxe_king", name: "Deluxe King", maxOcc: 2 },
    { id: "cat-dt", code: "deluxe_twin", name: "Deluxe Twin", maxOcc: 2 },
    { id: "cat-su", code: "suite", name: "Suite", maxOcc: 2 },
  ],
  rooms: [
    { id: "sr-207", number: "207", floorId: "fl-2", categoryId: "cat-dq" },
    { id: "sr-407", number: "407", floorId: "fl-1", categoryId: "cat-dk" },
    { id: "sr-201", number: "201", floorId: "fl-2", categoryId: "cat-dt" },
    { id: "sr-502", number: "502", floorId: "fl-3", categoryId: "cat-su" },
  ],

  hasCompletedHotelOnboarding:
    typeof window !== "undefined"
      ? localStorage.getItem("hos_hotel_onboarded") === "true"
      : false,
  hasCompletedStaffTour:
    typeof window !== "undefined"
      ? localStorage.getItem("hos_staff_tour_completed") === "true"
      : false,
  // Never auto-open for existing hotels. Settings / new-tenant CTA only.
  isHotelOnboardingOpen: false,
  isStaffTourOpen: false,

  openHotelOnboarding: () => set({ isHotelOnboardingOpen: true }),
  closeHotelOnboarding: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hos_hotel_onboard_dismissed", "true");
    }
    set({ isHotelOnboardingOpen: false });
  },

  completeHotelOnboarding: (patch) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hos_hotel_onboarded", "true");
    }
    set((s) => ({
      ...s,
      hotelName: patch.hotelName,
      dzongkhag: patch.dzongkhag,
      dotStars: patch.dotStars,
      tradeLicense: patch.tradeLicense,
      tpn: patch.tpn,
      scEnabled: patch.scEnabled,
      bstEnabled: patch.bstEnabled,
      hasCompletedHotelOnboarding: true,
      isHotelOnboardingOpen: false,
      isStaffTourOpen: true, // Automatically transition smoothly into the interactive staff tour!
    }));
  },

  startStaffTour: () => set({ isStaffTourOpen: true }),
  closeStaffTour: () => set({ isStaffTourOpen: false }),
  completeStaffTour: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hos_staff_tour_completed", "true");
    }
    set({ hasCompletedStaffTour: true, isStaffTourOpen: false });
  },

  updateProfile: (patch) => set((s) => ({ ...s, ...patch })),
  updateFiscal: (patch) => set((s) => ({ ...s, ...patch })),
  updatePayments: (patch) => set((s) => ({ ...s, ...patch })),

  addFloor: (label) =>
    set((s) => ({
      floors: [
        ...s.floors,
        { id: crypto.randomUUID(), label, sort: s.floors.length },
      ],
    })),

  addCategory: (code, name, maxOcc) =>
    set((s) => ({
      categories: [
        ...s.categories,
        { id: crypto.randomUUID(), code, name, maxOcc },
      ],
    })),

  addRoom: (number, floorId, categoryId) =>
    set((s) => ({
      rooms: [
        ...s.rooms,
        { id: crypto.randomUUID(), number, floorId, categoryId },
      ],
    })),
}));
